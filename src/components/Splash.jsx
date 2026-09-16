/**
 * Full-screen splash shown while the app boots.
 * `hiding` triggers the fade-out; the parent removes it once the
 * transition finishes.
 */
export default function Splash({ hiding, onHidden }) {
  return (
    <div
      className={`splash${hiding ? " hiding" : ""}`}
      onTransitionEnd={() => {
        if (hiding) onHidden?.();
      }}
    >
      <div className="splash-card">
        <img className="splash-img" src="/splash.gif" alt="EV Charger Finder" />
      </div>
      <div className="splash-caption">Finding charging stations near you…</div>
    </div>
  );
}
