import { ACCOUNT_POLICY_VERSION } from "@/shared/account-policy";
export default function Page() { return <main className="journey-shell"><h1>Guardian registration authorization</h1>
  <p>Students of all ages are welcome. Registration for younger students requires verified guardian identity, authority and consent under the pilot safeguarding policy.</p>
  <p>Registration authorization does not grant access to a student's academic reports. Sharing permissions are separate and optional.</p>
  <p>Policy version: {ACCOUNT_POLICY_VERSION}. Public guardian verification is not activated; an approved verification process and legally reviewed policies are required before launch.</p>
  <nav className="mock-links"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/login">Guardian login</a><a href="/signup">Student registration</a></nav>
</main>; }
