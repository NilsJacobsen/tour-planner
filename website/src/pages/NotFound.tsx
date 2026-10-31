import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="seitenbreite abschnitt">
      <h1>Seite nicht gefunden</h1>
      <p>
        Diese Seite gibt es nicht (mehr). <Link to="/">Zu allen Touren</Link>
      </p>
    </div>
  );
}
