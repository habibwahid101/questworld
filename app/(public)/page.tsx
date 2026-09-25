import {
  EarningsExampleSection,
  FinalCtaSection,
  FaqPreviewSection,
  HeroSection,
  HighlightsSection,
  HowItWorksSection,
  PaymentSection,
  PlansSection,
  ReferralSection,
  WhySection,
} from "@/components/public/home/HomeSections";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <HighlightsSection />
      <HowItWorksSection />
      <PlansSection />
      <EarningsExampleSection />
      <ReferralSection />
      <WhySection />
      <PaymentSection />
      <FaqPreviewSection />
      <FinalCtaSection />
    </>
  );
}
