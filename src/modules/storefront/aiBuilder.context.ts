/**
 * Static documentation of available Puck components and their prop schemas.
 * This is used as the system context for the LLM to ensure it generates valid Puck JSON.
 */
export const PUCK_COMPONENT_CONTEXT = `
Available Puck Components and their Props:

1. Navbar
   - logo: string (Store name)
   - links: string (Format: "Label1:href1|Label2:href2")
   - bgColor: string (Hex color)
   - textColor: string (Hex color)
   - sticky: boolean

2. Hero
   - heading: string
   - subtext: string
   - ctaText: string
   - ctaLink: string (e.g., "/products")
   - bgImage: string (URL)
   - bgColor: string (Hex color)
   - textColor: string (Hex color)
   - buttonBgColor: string (Hex color)
   - buttonTextColor: string (Hex color)

3. ProductCarousel
   - category: string (Category name to filter products)
   - maxItems: number (1-20)
   - showPrice: boolean
   - title: string
   - bgColor: string (Hex color)
   - titleColor: string (Hex color)

4. ProductGrid
   - category: string
   - columns: number (1-6)
   - showPrice: boolean
   - showCartButton: boolean
   - gap: number (0-64)
   - title: string
   - bgColor: string (Hex color)
   - titleColor: string (Hex color)

5. FeaturedProduct
   - productId: string (Required)
   - layout: "vertical" | "horizontal"
   - showDescription: boolean
   - bgColor: string (Hex color)
   - textColor: string (Hex color)
   - accentColor: string (Hex color)

6. Text
   - content: string
   - fontSize: number
   - weight: number (e.g., 400, 500, 700)
   - color: string (Hex)
   - align: "left" | "center" | "right"
   - bgColor: string (Hex color)
   - padding: number (px)

7. Image
   - url: string
   - alt: string
   - width: number (percentage 0-100)
   - borderRadius: number (px)

8. ImageGallery
   - images: string (Newline-separated URLs)
   - columns: number (1-4)
   - gap: number (px)
   - borderRadius: number (px)

9. Spacer
   - height: number (px, 0-500)

10. Divider
    - color: string (Hex)
    - thickness: number (px)
    - width: number (percentage)

11. Footer
    - text: string
    - links: string (Format: "Label:href|Label:href")
    - bgColor: string
    - textColor: string

12. Video
    - url: string (YouTube embed URL)
    - aspectRatio: string (e.g., "16/9", "4/3")

13. Testimonials
    - reviews: string (Pipe-separated review texts)
    - columns: number (1-3)
    - heading: string
    - bgColor: string (Hex color)
    - cardBgColor: string (Hex color)
    - textColor: string (Hex color)

14. Newsletter
    - heading: string
    - placeholder: string
    - buttonText: string
    - bgColor: string (Hex color)
    - textColor: string (Hex color)
    - buttonBgColor: string (Hex color)
    - buttonTextColor: string (Hex color)

15. Countdown
    - targetDate: string (ISO date string, e.g., "2026-12-31")
    - label: string
    - colorScheme: "amber" | "dark"
    - bgColor: string (Hex color)
    - textColor: string (Hex color)

16. Container
    - bgColor: string
    - textColor: string
    - padding: number (px)
    - border: string (Color hex)
    - maxWidth: number (px)
    - content: string

Page Data Structure:
Each page must include id, pageName, pageSlug, isHomepage, and puckData.
Preserve existing page ids when editing existing pages. Generate stable unique ids for newly created pages.
If a homepage already exists in the current site, reuse its id, keep pageSlug as "", and keep exactly one page with isHomepage true.
Use bright ecommerce-friendly colors by default: light backgrounds, dark readable text, and one saturated accent color.
Avoid making the whole site black, dark gray, or monochrome unless the user explicitly asks for a dark theme.
{
  "id": "page-id",
  "pageName": "Home",
  "pageSlug": "",
  "isHomepage": true,
  "puckData": {
    "content": [
      {
        "type": "ComponentName",
        "props": { "id": "unique-id", ...props }
      }
    ],
    "root": {
      "props": {}
    }
  }
}
`;
