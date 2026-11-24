import { createPublicPage } from "@/components/public-page";

const page = createPublicPage("adults");

export const generateMetadata = page.generateMetadata;
export default page.Page;
