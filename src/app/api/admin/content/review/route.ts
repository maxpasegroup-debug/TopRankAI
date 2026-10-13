import { adminMutation } from "@/server/api/admin-handler";
import { reviewContentSchema } from "@/server/content/authoring-validation";
import { reviewContent } from "@/server/content/authoring";
export const POST = adminMutation(reviewContentSchema, reviewContent);
