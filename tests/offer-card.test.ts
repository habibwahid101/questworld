import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("dashboard shows the profile offer above the profile card only when one is returned", () => {
  const dashboard = read("../components/member/DashboardPanel.tsx");
  assert.match(dashboard, /import \{ OfferCard \} from "@\/components\/member\/OfferCard"/);
  assert.match(dashboard, /readCurrentProfileOffer\(\)/);
  assert.match(dashboard, /\.catch\(\(\) => undefined\)/);
  assert.match(dashboard, /\{offer \? <OfferCard [^}]*title=\{offer\.title\}/);
  const offerAt = dashboard.indexOf("<OfferCard");
  const profileAt = dashboard.indexOf("<Card className={styles.profileCard}>");
  assert.ok(offerAt > 0 && profileAt > offerAt, "OfferCard renders above the profile card");
});

test("profile page still shows the offer card", () => {
  const profile = read("../components/member/ProfilePanel.tsx");
  assert.match(profile, /\{offer \? <OfferCard /);
  assert.match(profile, /readCurrentProfileOffer\(\)/);
});

test("offer image is shown in full, not cropped", () => {
  const css = read("../components/member/OfferCard.module.css");
  const image = css.match(/\.image \{[^}]*\}/)?.[0] ?? "";
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.match(image, /object-fit:\s*contain/);
  assert.match(image, /width:\s*100%/);
  assert.match(image, /height:\s*auto/);
  const card = read("../components/member/OfferCard.tsx");
  assert.match(card, /<img className=\{styles\.image\}/);
  assert.ok(card.indexOf("<img") < card.indexOf("styles.title"), "title stays under the image");
});
