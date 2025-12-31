import { z } from "zod";

try {
  const schema = z.string();
  schema.parse(123);
} catch (error: any) {
  if (error instanceof z.ZodError) {
    console.log("--- START DEBUG ---");
    console.log("Keys:", JSON.stringify(Object.keys(error)));
    console.log("Has 'errors':", "errors" in error);
    console.log("Has 'issues':", "issues" in error);
    console.log("--- END DEBUG ---");
  }
}
