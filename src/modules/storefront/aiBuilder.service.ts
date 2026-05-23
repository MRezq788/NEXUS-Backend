import { ChatMistralAI } from "@langchain/mistralai";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { PUCK_COMPONENT_CONTEXT } from "./aiBuilder.context";
import { AiRouterOutputSchema } from "./aiBuilder.schema";

// --- State Definition ---

const GraphState = Annotation.Root({
  prompt: Annotation<string>(),
  currentPages: Annotation<any[]>(),
  activePageId: Annotation<string | undefined>(),
  targetPath: Annotation<"CREATE_SITE" | "EDIT_PAGE" | "CREATE_PAGE" | undefined>(),
  generatedPages: Annotation<any[]>(),
  rawGeneratedContent: Annotation<string>(),
  reasoning: Annotation<string>(),
});

const contentToString = (content: unknown) =>
  typeof content === "string" ? content : JSON.stringify(content);

const extractJsonArray = (content: string) => {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] || content;
  const jsonMatch = candidate.match(/\[[\s\S]*\]/);
  return jsonMatch ? jsonMatch[0] : candidate;
};

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const createFallbackPage = (state: typeof GraphState.State) => {
  const activePage = state.currentPages.find((page) => page.id === state.activePageId) || state.currentPages[0];
  const fallbackName = state.targetPath === "CREATE_PAGE" ? state.prompt.split(/\s+/).slice(0, 4).join(" ") : "Home";
  const pageName = activePage?.pageName || fallbackName || "Generated Page";

  return {
    id: activePage?.id || `ai-${toSlug(pageName) || "page"}`,
    pageName,
    pageSlug: activePage?.pageSlug ?? (state.targetPath === "CREATE_SITE" ? "" : toSlug(pageName)),
    siteName: activePage?.siteName,
    isHomepage: activePage?.isHomepage ?? state.targetPath === "CREATE_SITE",
  };
};

const looksLikePuckNode = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      "props" in value &&
      !("puckData" in value),
  );

const normalizeGeneratedPages = (parsed: unknown, state: typeof GraphState.State) => {
  if (!Array.isArray(parsed)) {
    return parsed;
  }

  const hasPageShape = parsed.some(
    (item) => item && typeof item === "object" && "puckData" in item,
  );

  if (hasPageShape) {
    return parsed;
  }

  if (parsed.every(looksLikePuckNode)) {
    const page = createFallbackPage(state);
    return [
      {
        ...page,
        puckData: {
          content: parsed,
          root: { props: {} },
        },
      },
    ];
  }

  return parsed;
};

const isHomepageLike = (page: any) =>
  Boolean(page?.isHomepage) || page?.pageSlug === "" || page?.pageSlug === "home";

const reconcileGeneratedPages = (
  generatedPages: any[],
  currentPages: any[],
  targetPath: typeof GraphState.State.targetPath,
  activePageId?: string,
  siteName?: string,
) => {
  const currentById = new Map(currentPages.map((page) => [page.id, page]));
  const currentBySlug = new Map(currentPages.map((page) => [page.pageSlug || "", page]));
  const currentHomepage = currentPages.find(isHomepageLike);
  const usedIds = new Set<string>();

  const reconciledGenerated = generatedPages.map((page, index) => {
    const matched =
      currentById.get(page.id) ||
      (isHomepageLike(page) ? currentHomepage : undefined) ||
      currentBySlug.get(page.pageSlug || "");

    const stableId = matched?.id || page.id || `ai-${toSlug(page.pageName || `page-${index + 1}`)}`;
    usedIds.add(stableId);

    return {
      ...page,
      id: stableId,
      pageSlug: isHomepageLike(page) && matched ? "" : page.pageSlug,
      siteName: page.siteName || matched?.siteName || siteName || "",
      isHomepage: matched ? Boolean(matched.isHomepage) : Boolean(page.isHomepage),
    };
  });

  const homepageSeen = { value: false };
  const normalizedHomepageFlags = reconciledGenerated.map((page) => {
    const shouldBeHomepage = isHomepageLike(page) && !homepageSeen.value;
    if (shouldBeHomepage) {
      homepageSeen.value = true;
    }

    return {
      ...page,
      pageSlug: shouldBeHomepage ? "" : page.pageSlug || toSlug(page.pageName || page.id),
      isHomepage: shouldBeHomepage,
    };
  });

  if (targetPath === "CREATE_SITE") {
    return normalizedHomepageFlags;
  }

  const merged = currentPages.map((currentPage) => {
    const replacement =
      normalizedHomepageFlags.find((page) => page.id === currentPage.id) ||
      normalizedHomepageFlags.find((page) => page.pageSlug === currentPage.pageSlug);

    return replacement || currentPage;
  });

  const additions = normalizedHomepageFlags.filter((page) => !currentPages.some((currentPage) => currentPage.id === page.id));

  if (targetPath === "EDIT_PAGE" && activePageId && !usedIds.has(activePageId) && normalizedHomepageFlags.length === 1) {
    return currentPages.map((currentPage) =>
      currentPage.id === activePageId
        ? {
            ...normalizedHomepageFlags[0],
            id: currentPage.id,
            pageName: currentPage.pageName,
            pageSlug: currentPage.pageSlug,
            siteName: currentPage.siteName || siteName || "",
            isHomepage: Boolean(currentPage.isHomepage),
          }
        : currentPage,
    );
  }

  return [...merged, ...additions];
};

// --- Model Setup ---

const getModel = () => {
  const apiKey = process.env.MISTRAL_API_KEY;
  const modelName = process.env.AI_BUILDER_MODEL || "mistral-small-latest";

  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is required for AI builder");
  }

  return new ChatMistralAI({
    model: modelName,
    apiKey,
    temperature: 0,
  });
};

// --- Nodes ---

/**
 * Node 1: Router
 * Analyzes the prompt and decides which path to take.
 */
const routerNode = async (state: typeof GraphState.State) => {
  const model = getModel();
  const structuredModel = model.withStructuredOutput(AiRouterOutputSchema);
  const response = await structuredModel.invoke([
    {
      role: "system",
      content: "You are an expert website builder router. Categorize the user request into CREATE_SITE (multiple pages), CREATE_PAGE (single new page), or EDIT_PAGE (modifying existing JSON).",
    },
    {
      role: "user",
      content: `User Prompt: ${state.prompt}\n\nCurrent Site Structure: ${JSON.stringify(state.currentPages)}`,
    },
  ]);

  return {
    targetPath: response.targetPath,
    reasoning: response.reasoning,
  };
};

/**
 * Node 2: Generator
 */
const generatorNode = async (state: typeof GraphState.State) => {
  const model = getModel();
  let systemPrompt = "";

  if (state.targetPath === "CREATE_SITE") {
    systemPrompt = `You are an expert AI Website Builder. Generate a complete multi-page site at least 3 pages structure using Puck components.
Available Components Doc: ${PUCK_COMPONENT_CONTEXT}
Return ONLY a JSON array of page objects. Do not return a Puck content array by itself.`;
  } else if (state.targetPath === "EDIT_PAGE") {
    systemPrompt = `You are an expert AI Website Editor. Modify the current page JSON based on user instructions.
Available Components Doc: ${PUCK_COMPONENT_CONTEXT}
Current Page ID: ${state.activePageId}
Current Site Structure: ${JSON.stringify(state.currentPages)}
Surgically edit ONLY what is requested.
Return ONLY the full JSON array of page objects. Do not return components by themselves.`;
  } else {
    systemPrompt = `You are an expert AI Page Creator. Create a single new page that matches the style of the existing site.
Available Components Doc: ${PUCK_COMPONENT_CONTEXT}
Current Site Structure: ${JSON.stringify(state.currentPages)}
Return ONLY the full JSON array of page objects. Do not return components by themselves.`;
  }

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: state.prompt },
  ]);

  const content = contentToString(response.content);
  const jsonStr = extractJsonArray(content);

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      generatedPages: normalizeGeneratedPages(parsed, state),
      rawGeneratedContent: content,
    };
  } catch (e) {
    return {
      generatedPages: [],
      rawGeneratedContent: content,
    };
  }
};

// --- Graph Assembly ---

const workflow = new StateGraph(GraphState)
  .addNode("router", routerNode)
  .addNode("generator", generatorNode)
  .addEdge(START, "router")
  .addEdge("router", "generator")
  .addEdge("generator", END);

export const aiBuilderGraph = workflow.compile();

/**
 * Service function to run the AI Builder pipeline
 */
export const runAiBuilder = async (prompt: string, currentPages: any[], activePageId?: string, siteName?: string) => {
  const initialState = {
    prompt,
    currentPages,
    activePageId,
    generatedPages: [],
    rawGeneratedContent: "",
    reasoning: "",
  };

  const result = await aiBuilderGraph.invoke(initialState);

  return reconcileGeneratedPages(
    result.generatedPages,
    currentPages,
    result.targetPath,
    activePageId,
    siteName,
  );
};