---
tag: 3
titel: Über den Col d'Arrémoulit nach Frankreich
kurz: Ein kurzer, aber kniffliger Tag – an den Seen von Arriel vorbei und durch ein Blockfeld über den Grenzpass zur Refuge d'Arrémoulit. Wer das nicht mag, fährt außen herum mit dem Petit train.
von: refugio-respomuso
nach: refuge-arremoulit
start: "08:00"

varianten:
  - id: col-d-arremoulit
    name: Über den Col d'Arrémoulit
    art: standard
    wetter: nur-stabil
    wetterhinweis: Nur bei trockenem Fels und guter Sicht. Bei Nebel, Nässe oder Schnee nehmen alle den Weg außen herum – das entscheiden wir am Abend vorher.
    text: Am Stausee entlang nach Westen, hinauf zu den Seen von Arriel und über das Blockfeld zum Pass, dann hinunter zur Hütte.
    entscheidung: vorabend
    abschnitte:
      - gehen: tag-3.gpx
    wegpunkte:
      - ort: col-d-arremoulit
        pause: 90
        hinweis: Mit dieser Pause rechnen wir die Zeit im Blockfeld mit ein – der Tourismusdienst gibt für die ganze Etappe viereinhalb Stunden an.
    quelle: https://geotrek65admin.openig.org/api/fr/treks/27849/etape-3-du-refuge-darremoulit-au-refuge-de-respomuso-espagne.pdf?portal=2
  - id: aussen-herum
    name: Außen herum mit Taxi und Petit train
    art: schlechtwetter
    entscheidung: vorabend
    start: "08:00"
    text: Zurück zum Stausee La Sarra, mit dem Taxi über den Col du Portalet nach Fabrèges, mit Kabinenbahn und Petit train zum Lac d'Artouste und zu Fuß hinauf zur Hütte.
    abschnitte:
      - gehen: tag-3-abstieg-la-sarra.gpx
      - fahrt:
          mittel: taxi
          von: la-sarra
          nach: fabreges
          dauer: 60
          hinweis: Taxi Formigal, am Vortag von der Hütte aus bestellen (+34 664 487 477). Der Kleinbus hat neun Plätze einschließlich Fahrer – sind wir mehr als acht, braucht es zwei Wagen.
          quelle: https://www.taxiformigal.com/
          geprueft: "2026-11-01"
      - fahrt:
          mittel: bahn
          von: fabreges
          nach: la-sagette
          dauer: 15
          hinweis: Kabinenbahn auf La Sagette, im September ab 9:15.
          quelle: https://artouste.fr/ete/fr/experiences/telecabine
          geprueft: "2026-11-01"
      - fahrt:
          mittel: zug
          von: la-sagette
          nach: lac-d-artouste
          dauer: 55
          abfahrt: "13:00"
          takt: 60
          letzte: "14:00"
          hinweis: Im September fährt der Petit train stündlich von 10 bis 14 Uhr (am Wochenende bis 15 Uhr); der Betreiber bittet, 45 Minuten vor der gebuchten Abfahrt da zu sein. Wir buchen den Zug um 13 Uhr. Saison 2027 vom 8. Mai bis 3. Oktober. Die Bergfahrt mit Kabinenbahn kostete 2026 als „One Way“ 24 €.
          quelle: https://artouste.fr/ete/fr/train
          geprueft: "2026-11-01"
      - gehen: tag-3-aufstieg-arremoulit.gpx
    quelle: https://refugedarremoulit.ffcam.fr/acces.html

uebernachtung:
  ort: refuge-arremoulit

schluesselstellen:
  - titel: Blockfeld am Col d'Arrémoulit
    text: Auf der französischen Seite des Passes liegt ein steiles Feld aus großen Granitblöcken, kaum markiert – man steigt von Block zu Block und nimmt an einigen Stellen die Hände. Der Tourismusdienst nennt die Etappe „schwierig“ und rechnet viereinhalb Stunden. In OpenStreetMap steht hier nur T2; wir rechnen mit T3 und mit mehr Zeit, als die Seite ausrechnet.
    quelle: https://geotrek65admin.openig.org/api/fr/treks/27849/etape-3-du-refuge-darremoulit-au-refuge-de-respomuso-espagne.pdf?portal=2

wasserHinweis: Unterwegs liegen die Seen von Arriel; trinken nur gefiltert. An der Hütte Respomuso die Flaschen füllen.

notabstieg: |
  Vor dem Pass zurück nach Respomuso. Auf dem Weg außen herum gibt es am Lac d'Artouste und in Fabrèges jederzeit einen Weg ins Tal.

bilder:
  - src: /bilder/pyrenaeen-ossau/pic-d-arriel.jpg
    motiv: Ein kleiner See zwischen Granitplatten bei Arrémoulit, darüber der Pic d'Arriel im Abendlicht unter Schäfchenwolken
    format: hoch
    credit: YannL64 (Wikimedia Commons)
    lizenz: CC BY 4.0
    quelle: "https://commons.wikimedia.org/wiki/File:Picdarriel.jpg"
---

Heute ist der Weg kurz, aber er hat es in sich. Von **Respomuso** gehen wir am Stausee entlang und steigen zu den **Seen von Arriel** auf, kleinen dunklen Augen zwischen Granit. Dann wird es steinig: Über ein Blockfeld geht es hinauf zum **Col d'Arrémoulit**, wo die Grenze verläuft. Auf der französischen Seite liegt die Refuge d'**Arrémoulit** schon in Sicht, umgeben von Seen und den Granitwänden des Palas.

Die Hütte wurde von Grund auf umgebaut und ist erst im Juli 2026 wieder eröffnet worden. Sie liegt in der Kernzone des Nationalparks; die Seen ringsum sind zum Anschauen da, nicht zum Baden.

Bei schlechtem Wetter oder wenn sich jemand im Blockgelände nicht wohlfühlt, gehen wir außen herum: zurück ins Tal, mit dem Taxi über den Col du Portalet nach Frankreich und mit Kabinenbahn und **Petit train d'Artouste** hinauf zum Lac d'Artouste. Von dort steigen wir an den Seen vorbei zur Hütte auf.
