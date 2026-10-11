# Salibandy TV – grafiikat

Tämä on **täysin erillinen GitHub/Vercel-projekti** salibandyn lähetysgrafiikoille. Se ei tarvitse BandyLive-/jääpalloprojektin tiedostoja eikä sisällä niiden koodia.

## Sisältö

- `index.html` – aloitussivu ja linkit grafiikoihin
- `salibandy-tulostaulu.html` – tulostaulu
- `salibandy-lowerthird.html` – maalintekijägrafiikka
- `salibandy-tilastot.html` – tilastot
- `salibandy-sarjataulukko.html` – ottelun sarjan sarjataulukko
- `api/salibandy-standings.js` – ottelun sarjan ja lohkon sarjataulukon haku TorneoPalista
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


## Grafiikoiden oletusnäkyvyys

Tulostaulu, tilastot, Lower Third ja kokoonpanot näkyvät oletuksena heti, eikä niiden näkyvyys riipu etäohjauksen/Upstashin asetuksista. Etäohjaus ja sen API-tiedostot ovat edelleen mukana paketissa valinnaista käyttöönottoa varten. Jos haluat yksittäisen grafiikan näkyvyyden etäohjauksen alaisuuteen, lisää sen URL-osoitteeseen `&remote=1` (tai jos URL:ssa ei ole kysymysmerkkiä, `?remote=1`). Ilman tätä parametria grafiikka pysyy päällä.


## Reaaliaikainen pelikello

Tulostaulun kello päivittyy neljä kertaa sekunnissa viimeisimmän TorneoPal-otteludatan perusteella. Kun `live_timer_on` on päällä, kello jatkaa sekuntien laskemista kyselyiden välissä. Kun kellon käyntitila on pois päältä, aika pysähtyy. Jokainen uusi API-vastaus synkronoi kellon uudelleen. Tämä edellyttää, että tulospalvelu toimittaa `live_time_mmss` tai `live_time` sekä `live_timer_on`-kentät.


## Palvelimelle tallennettava oletusottelu (GitHub + Vercel)

Oletusottelu tallennetaan GitHub-repositorion tiedostoon `config/salibandy-default-match.json` Vercelin API-reitin kautta. Grafiikat, joiden URL-osoitteessa ei ole `?match_id=...`, lukevat oletuksen palvelimelta. Suora `?match_id=...` ohittaa oletuksen.

Lisää Vercel-projektin **Settings → Environment Variables** -kohtaan:

- `GITHUB_TOKEN`: GitHub fine-grained personal access token, jolla on vain tähän repositoryyn **Contents: Read and write** -oikeus.
- `GITHUB_REPOSITORY`: repository muodossa `omistaja/reponimi` (esim. `oma-tunnus/SALIBANDY-TV`).
- `DEFAULT_MATCH_CONTROL_PASSWORD`: pitkä salasana, jota kysytään index-sivun oletusottelun tallennuksessa.

Lisää muuttujat Production-ympäristöön (ja halutessasi Previewyn) ja tee Vercelissä uusi deployment. Älä koskaan lisää GitHub-tokenia HTML-tiedostoon tai julkaise sitä GitHubissa. Index-sivun salasana lähetetään vain palvelinreitille; se ei tallennu selaimeen. Ensimmäisellä tallennuksella API luo GitHubiin `config/salibandy-default-match.json`-tiedoston automaattisesti.

Jos API näyttää virheen 503, jokin yllä olevista ympäristömuuttujista puuttuu. Jos tallennus epäonnistuu oikeusvirheeseen, tarkista että tokenilla on kyseiseen repositoryyn Contents read/write -oikeus.


## Tulostaulun eränäyttö (valinnainen)

Tulostaulun tavallinen sekuntikello toimii ennallaan, kun URL-osoitteessa ei ole eränäytön parametreja. Jos haluat kellon paikalle erätunnuksen, lisää `clockmode=period` ja `period`-arvo:

- `salibandy-tulostaulu.html?clockmode=period&period=1` → `1. ERÄ`
- `salibandy-tulostaulu.html?clockmode=period&period=2` → `2. ERÄ`
- `salibandy-tulostaulu.html?clockmode=period&period=3` → `3. ERÄ`
- `salibandy-tulostaulu.html?clockmode=period&period=JA` → `JA` (jatkoaika)
- `salibandy-tulostaulu.html?clockmode=period&period=RL` → `RL` (rangaistuslaukaukset)

Tämä parametri on tarkoitettu tulostaulun kellon paikalle tulevaan erämerkintään. Se ei muuta varsinaisen ottelukellon toimintaa muissa URL-osoitteissa. Eräarvo annetaan URL:ssa, joten lähetysohjaaja voi vaihtaa sen tarpeen mukaan. `match_id`, `scale`, `refresh` ja muut aiemmat parametrit toimivat edelleen yhdessä tämän kanssa.
