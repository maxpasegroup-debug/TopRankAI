import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageContainer } from "../components/ui/PageContainer";
import { SectionHeader } from "../components/ui/SectionHeader";

export function Settings() {
  return (
    <PageContainer>
      <div className="screen-stack">
        <SectionHeader
          eyebrow="Settings"
          title="Keep TopRank comfortable"
          subtitle="A simple preview of the preferences students may manage later."
          action={<Button href="/home">Save preview</Button>}
        />
        <div className="grid grid-2">
          <Card>
            <h2 style={{ marginTop: 0 }}>Language</h2>
            <p style={{ color: "var(--color-muted)" }}>Simple English selected.</p>
          </Card>
          <Card>
            <h2 style={{ marginTop: 0 }}>Daily reminder</h2>
            <p style={{ color: "var(--color-muted)" }}>Evening mission reminder preview.</p>
          </Card>
          <Card>
            <h2 style={{ marginTop: 0 }}>Account</h2>
            <p><a href="/account/consent">Account consent</a></p>
            <p><a href="/account/privacy-requests">Account support &amp; privacy</a></p>
            <p style={{ color: "var(--color-muted)" }}>End this secure session on the current device.</p>
            <form action="/api/auth/logout" method="post">
              <button className="button button-secondary" type="submit">Log out</button>
            </form>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
