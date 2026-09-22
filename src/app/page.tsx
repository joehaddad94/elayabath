import { Blueprint } from "@/components/Blueprint/Blueprint";
import { Container, Section } from "@/components/Container/Container";
import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";

/**
 * Temporary. This route exists so milestone 1 can be verified: both palettes
 * render, the toggle persists across a reload, and the system's primitives
 * are wired up. The real homepage replaces it in milestone 4.
 */
export default function DesignCheckPage() {
  return (
    <main>
      <Section>
        <Container>
          <ThemeToggle label="Palette" />
          <h1>Because Bathrooms Matter</h1>
          <p>
            Design system check: both palettes, the blueprint frame and the
            registration marks.
          </p>
          <Blueprint as="article">
            <p>
              A blueprint object. Square corners, a hairline border, and a
              registration mark at each corner.
            </p>
          </Blueprint>
        </Container>
      </Section>
    </main>
  );
}
