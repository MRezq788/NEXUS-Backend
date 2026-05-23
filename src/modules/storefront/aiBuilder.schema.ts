import { z } from "zod";

export const PuckComponentTypeSchema = z.enum([
  "Navbar",
  "Hero",
  "ProductCarousel",
  "ProductGrid",
  "FeaturedProduct",
  "Text",
  "Image",
  "ImageGallery",
  "Spacer",
  "Divider",
  "Footer",
  "Video",
  "Testimonials",
  "Newsletter",
  "Countdown",
  "Container",
]);

/**
 * Zod schema for a single component node in Puck
 */
export const PuckNodeSchema: z.ZodType<{
  type: z.infer<typeof PuckComponentTypeSchema>;
  props: Record<string, unknown> & { id?: string };
  content?: unknown[];
}> = z.lazy(() =>
  z.object({
    type: PuckComponentTypeSchema,
    props: z.record(z.string(), z.unknown()).and(
      z.object({
        id: z.string().optional(),
      }),
    ),
    content: z.array(z.unknown()).optional(),
  }),
);

/**
 * Zod schema for the full puckData object
 */
export const PuckDataSchema = z.object({
  content: z.array(PuckNodeSchema),
  root: z.object({
    props: z.record(z.string(), z.unknown())
  }).optional().default({ props: {} }),
  zones: z.record(z.string(), z.array(PuckNodeSchema)).optional(),
});

/**
 * Zod schema for a single page object in the AI generator output
 */
export const AiPageSchema = z.object({
  id: z.string(),
  pageName: z.string(),
  pageSlug: z.string(),
  siteName: z.string().optional(),
  isHomepage: z.boolean().default(false),
  puckData: PuckDataSchema,
});

/**
 * Zod schema for the entire site structure returned by the AI
 */
export const AiPageArraySchema = z.array(AiPageSchema).min(1, "At least one page is required");

/**
 * Schema for the Router's structured output
 */
export const AiRouterOutputSchema = z.object({
  targetPath: z.enum(["CREATE_SITE", "EDIT_PAGE", "CREATE_PAGE"]),
  reasoning: z.string(),
});
