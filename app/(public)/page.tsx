import {
  BenefitsSection,
  EarningsExampleSection,
  FaqPreviewSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  PlansSection,
  ReferralSection,
  WhySection,
} from "@/components/public/home/HomeSections";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BenefitsSection />
      <HowItWorksSection />
      <PlansSection />
      <EarningsExampleSection />
      <ReferralSection />
      <WhySection />
      <FaqPreviewSection />
      <FinalCtaSection />
    </>
  );
}
