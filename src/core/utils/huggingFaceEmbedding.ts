const DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const EXPECTED_DIMENSIONS = 384;

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) return vector;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function meanPool(matrix: number[][]): number[] {
  if (matrix.length === 0) return [];
  const dimensions = matrix[0]?.length ?? 0;
  const pooled = Array.from({ length: dimensions }, () => 0);

  for (const row of matrix) {
    row.forEach((value, index) => {
      pooled[index] += value;
    });
  }

  return pooled.map((value) => value / matrix.length);
}

function parseEmbedding(payload: unknown): number[] {
  if (
    Array.isArray(payload) &&
    payload.every((value) => typeof value === "number")
  ) {
    return normalizeVector(payload as number[]);
  }

  if (
    Array.isArray(payload) &&
    payload.every(
      (row) =>
        Array.isArray(row) &&
        row.every((value) => typeof value === "number"),
    )
  ) {
    return normalizeVector(meanPool(payload as number[][]));
  }

  throw new Error("Unexpected Hugging Face embedding response.");
}

export async function createHuggingFaceEmbedding(text: string): Promise<number[]> {
  const apiToken = process.env.HUGGINGFACE_API_TOKEN;
  const model = process.env.HUGGINGFACE_EMBEDDING_MODEL || DEFAULT_MODEL;

  if (!apiToken) {
    throw new Error("HUGGINGFACE_API_TOKEN is required for embeddings.");
  }

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [text || " "],
        options: {
          wait_for_model: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Hugging Face embedding failed: ${response.status} ${message}`);
  }

  const embedding = parseEmbedding(await response.json());

  if (embedding.length !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `Hugging Face model returned ${embedding.length} dimensions, expected ${EXPECTED_DIMENSIONS}.`,
    );
  }

  return embedding;
}

export function vectorToSqlLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
