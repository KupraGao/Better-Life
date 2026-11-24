import { createPublicPage } from "@/components/public-page";

const page = createPublicPage("books");

export const generateMetadata = page.generateMetadata;
export default page.Page;
