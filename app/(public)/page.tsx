import {
  AboutSection,
  BusinessSection,
  FinalCtaSection,
  HeroSection,
  HowToStartSection,
  NotesSection,
} from "@/components/public/home/HomeSections";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <AboutSection />
      <BusinessSection />
      <HowToStartSection />
      <NotesSection />
      <FinalCtaSection />
    </>
  );
}
