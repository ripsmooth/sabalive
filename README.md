# Salibandy TV – grafiikat

Tämä on **täysin erillinen GitHub/Vercel-projekti** salibandyn lähetysgrafiikoille. Se ei tarvitse BandyLive-/jääpalloprojektin tiedostoja eikä sisällä niiden koodia.

## Sisältö

- `index.html` – aloitussivu ja linkit grafiikoihin
- `salibandy-tulostaulu.html` – tulostaulu
- `salibandy-lowerthird.html` – maalintekijägrafiikka
- `salibandy-tilastot.html` – tilastot
- `salibandy-kokoonpanot.html` – joukkueiden kokoonpanot
- `salibandy-grafiikkaohjaus.html` – grafiikoiden ohjauspaneeli
- `api/salibandy-match.js` – ottelutiedot Salibandyliiton TorneoPal-rajapinnasta
- `api/salibandy-graphics-state.js` – etäohjauksen näkyvyystila

## Uuden GitHub/Vercel-projektin käyttöönotto

1. Luo GitHubiin uusi tyhjä repository, esimerkiksi `salibandy-tv-grafiikat`.
2. Pura ZIP ja lataa **kaikki tämän kansion tiedostot ja kansiot** uuden repositoryn juureen. `api`-kansion pitää olla repositoryn juuressa.
3. Vercelissä valitse **Add New → Project** ja tuo juuri luomasi uusi GitHub-repository.
4. Framework Preset: **Other**. Build Command ja Output Directory jätetään tyhjiksi/oletuksiksi. Deploy.
5. Avaa uuden projektin oma Vercel-osoite. Aloitussivu tarjoaa linkit grafiikoihin ja API-testiin.

## Testaa otteludata

Avaa uuden projektin osoitteessa:

`/api/salibandy-match?match_id=953141`

Kun API toimii, vastauksen pitäisi olla JSON-dataa. Jos se palauttaa virheen, tarkista Vercelin Functions Logs.

## Grafiikoiden URL-parametrit

- `match_id` tai `ottelu`: ottelun ID, oletus `953141`
- `scale`: grafiikan skaala
- `width`: grafiikan leveys, jos kyseinen grafiikka tukee sitä
- `refresh`: päivitysväli sekunteina

## Etäohjaus (valinnainen)

Ottelutietojen ja staattisten grafiikoiden testaamiseen ei tarvitse määrittää Upstashia. Etäohjauksen tallennus tarvitsee oman Upstash Redis REST -tietokannan ja seuraavat Vercelin Environment Variables -asetukset:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GRAPHICS_CONTROL_PASSWORD`

Lisää muuttujat Vercelin Project Settings → Environment Variables -osiossa ja tee uusi deployment. Käytä vahvaa, omaa ohjaussalasanaa. Etäohjaus käyttää Redis-avainta `salibandy:graphics:visibility`.

## Tärkeää

- Tämä projekti on erillinen. Älä tuo tähän jääpallon repositoryä äläkä yhdistä sitä BandyLive-projektiin.
- Pelaaja- ja ottelutiedot riippuvat TorneoPalin julkisen rajapinnan vastauksesta.
- Laukaus- ja torjuntatilastot näkyvät vain siltä osin kuin rajapinta tarjoaa ne.
