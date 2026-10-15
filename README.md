# Salibandy TV – grafiikat

Tämä on **täysin erillinen GitHub/Vercel-projekti** salibandyn lähetysgrafiikoille. Se ei tarvitse BandyLive-/jääpalloprojektin tiedostoja eikä sisällä niiden koodia.

## Sisältö

- `index.html` – aloitussivu ja linkit grafiikoihin
- `salibandy-tulostaulu.html` – tulostaulu
- `salibandy-eratauko.html` – erätauon grafiikka, oletusleveys 1400 px
- `salibandy-lowerthird.html` – maalintekijägrafiikka
- `salibandy-selostaja.html` – selostajan nimigrafiikka (oletus: Jussi Valli)
- `salibandy-tilastot.html` – tilastot
- `salibandy-sarjataulukko.html` – ottelun sarjan sarjataulukko
- `api/salibandy-standings.js` – ottelun sarjan ja lohkon sarjataulukon haku TorneoPalista
- `salibandy-kokoonpanot.html` – joukkueiden kokoonpanot
- `salibandy-otteluntapahtumat.html` – kaikki maalit, rangaistukset ja aikalisät aikajärjestyksessä
- `salibandy-tehopelaajat.html` – kompakti grafiikka molempien joukkueiden tehopisteitä tehneistä pelaajista
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

Tulostaulu, tilastot, Lower Third, erätauko ja kokoonpanot näkyvät oletuksena heti, eikä niiden näkyvyys riipu etäohjauksen/Upstashin asetuksista. Etäohjaus ja sen API-tiedostot ovat edelleen mukana paketissa valinnaista käyttöönottoa varten. Jos haluat yksittäisen grafiikan näkyvyyden etäohjauksen alaisuuteen, lisää sen URL-osoitteeseen `&remote=1` (tai jos URL:ssa ei ole kysymysmerkkiä, `?remote=1`). Ilman tätä parametria grafiikka pysyy päällä.


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


## Tulostaulun automaattinen eränäyttö (valinnainen)

Tulostaulun tavallinen sekuntikello toimii ennallaan, kun eränäytön parametria ei käytetä. Kun haluat kellon paikalle virallisen tulospalvelun ilmoittaman erän, lisää URL-osoitteeseen joko `clock=period` tai `clockmode=period`. Molemmat toimivat.

Esimerkki:

`salibandy-tulostaulu.html?match_id=935611&clock=period`

Grafiikka lukee erän ottelun TorneoPal-tiedoista: ensisijaisesti `live_period`-kentästä. Arvot 1–3 näytetään muodossa `1. ERÄ`, `2. ERÄ` ja `3. ERÄ`. Kun rajapinta ilmoittaa seuraavan jakson ja ottelun tiedoissa on jatkoajan asetukset, näytetään `JA`; jatkoajan jälkeinen rangaistuslaukausjakso näytetään `RL`. Erätieto päivittyy samalla kyselyvälillä kuin muutkin ottelutiedot.

Halutessasi voit edelleen asettaa manuaalisen yliajon `period`-parametrilla:

- `?clock=period&period=1` → `1. ERÄ`
- `?clock=period&period=2` → `2. ERÄ`
- `?clock=period&period=3` → `3. ERÄ`
- `?clock=period&period=JA` → `JA`
- `?clock=period&period=RL` → `RL`

Jos rajapinta ei palauta voimassa olevaa erätietoa, grafiikka näyttää viivan (`—`) eikä arvaa eräksi ensimmäistä erää. Ottelun tunnisteena hyväksytään `match_id`, `ottelu` tai `match`.



## Tulostaulun lähetysviive

Tulostaulun voi viivästää URL-parametrilla `delay` sekunteina. Esimerkiksi `?match_id=935611&delay=15` näyttää tulostaulun tulos- ja ottelutietojen päivitykset noin 15 sekuntia niiden vastaanottamisen jälkeen. `delay=0` tai parametrin puuttuminen säilyttää normaalin reaaliaikaisen toiminnan. Suurin sallittu arvo on 300 sekuntia.

Viivejono tallennetaan saman selaimen paikalliseen tallennustilaan, jotta sivun uudelleenlataus ei normaalisti ohita viivettä. Viive toimii parhaiten, kun OBS:n selainlähde pysyy samalla selaimen tallennustilalla käytössä. Ensimmäisellä käyttökerralla tai tyhjennetyllä selaintallennustilalla tulostaulu odottaa viiveen täyttymistä ennen uusien tietojen näyttämistä. Viiveen tarkkuus riippuu päivitysvälistä ja on yleensä noin yhden kyselyvälin sisällä asetetusta arvosta.

## Tulostaulun asettelu – viimeisin viilaus

- Vierasjoukkueen nimi näkyy ennen logoa; logo sijoittuu oikeaan reunaan.
- Pelikello-/eränäyttöalue on hieman leveämpi, jotta esimerkiksi `2. ERÄ` mahtuu paremmin.
- Eränäytön URL-parametrit `clock=period` ja `clockmode=period` säilyvät käytössä.


## Maalitapahtumien syöttäjätieto

Tulostaulun tapahtumagrafiikka rikastaa maalit `match.events`-listan tiedoilla: maalin tapahtuma yhdistetään `match.goals`-listan vastaavaan maaliin `event_id`-kentän avulla. Jos TorneoPal toimittaa syöttäjän, ilmoituksessa näytetään maalintekijän alla esimerkiksi `(#18 Seikkula Marko)`. Jos syöttäjätietoa ei ole virallisessa vastauksessa, tapahtuma näyttää edelleen tuloksen.


## Ottelun tapahtumat

`salibandy-otteluntapahtumat.html` näyttää joukkueiden logot, nimet, tuloksen, pelikellon ja maalit, rangaistukset sekä aikalisät kellonajan mukaisessa aikajärjestyksessä. Sivun tapahtumalista käyttää `match.goals`-, `match.bookings`- ja `match.events`-tietoja, eikä näytä esimerkiksi vaihtoja tai torjuntoja. Lista vierittää oletuksena alareunaan uusimpien tapahtumien luo.

- `?match_id=OTTELUN_ID` – valitsee ottelun
- `?width=1200` – grafiikan leveys
- `?scale=1` – skaalaus
- `?refresh=3` – päivitysväli sekunteina
- `?preview=1` – esimerkkitapahtumat ilman API-yhteyttä
- `?remote=1` – ottaa sivun mukaan etäohjauksen näkyvyystilaan


## Ottelun tehopelaajat

`salibandy-tehopelaajat.html` näyttää rinnakkain molempien joukkueiden pelaajat, joilla on vähintään yksi tehopiste. Pelaajat lajitellaan pisteiden, maalien ja syöttöjen mukaan. Rivillä näkyvät maalit + syötöt = pisteet (esim. `3 + 0 = 3`). Tiedot luetaan otteluvastauksen `lineups`-listan `goals`, `assists` ja `points` -kentistä.

- `?match_id=OTTELUN_ID` – valitsee ottelun
- `?width=575` – grafiikan leveys pikseleinä, oletus 575
- `?scale=1` – skaalaus
- `?refresh=3` – päivitysväli sekunteina
- `?preview=1` – esimerkkitaulukko ilman API-yhteyttä
- `?remote=1` – ottaa näkyvyyden grafiikkaohjauksen alle

Suositeltu OBS-selainlähteen koko on noin 575 × 360 pikseliä; aseta lähde tulostaulun alapuolelle. Voit ohjauspaneelissa valita **Näytä tulostaulu + tehopelaajat**, jolloin tulostaulu jää näkyviin ja tehopelaajalista tulee sen alle.


## Grafiikan koon hienosäätö URL-osoitteella

Kaikki seitsemän grafiikkasivua tukevat parametreja `width` ja `height` pikseleinä. `width` muuttaa grafiikan leveyttä ja `height` sovittaa näkyvän grafiikan haluttuun korkeuteen myös silloin, kun tapahtumien tai pelaajien määrä muuttuu. Jos `height` puuttuu, korkeus pysyy sisällön mukaisena. `scale` on edelleen yleinen lisäskaalaus (0.5–2.5).

Esimerkki: `salibandy-tulostaulu.html?width=650&height=90&offsetX=50&offsetY=40`

Esikatseluun voi lisätä `debug=1`, jolloin sivun oikeaan alakulmaan tulee näkyvien mittojen diagnostiikka. Tulostaulussa sama diagnostiikka näyttää lisäksi TorneoPalin `live_A/live_B`- ja `fs_A/fs_B`-arvot, ruudulla näytettävän tuloksen sekä mahdollisen vanhan tuloksen vahvistuksen. Selaimen konsoliin kirjataan samat tulostiedot päivityksittäin. Tulostaulun suojaus hyväksyy maalimäärän pienentymisen vasta, kun sama alempi tulos on nähty vähintään viidessä kyselyssä ja vähintään 12 sekunnin ajan; suurempi tulos hyväksytään heti.

Oletusleveydet: tulostaulu 575 px; erätauko 1400 px; tehopelaajat 575 px; tilastot 1400 px; Lower Third 1400 px; ottelun tapahtumat 1200 px; kokoonpanot 840 px; sarjataulukko 1100 px. Korkeus on oletuksena automaattinen ja riippuu näkymän sisällöstä.


## Viimeisimmät ulkoasumuutokset

- Sarjataulukko käyttää nyt 1,5-kertaista oletusskaalaa ja keskitetään sekä vaaka- että pystysuunnassa. Jos taulukko ei mahdu näyttöön, skaala pienenee automaattisesti koko taulukon mittasuhteet säilyttäen. `width=`, `height=`, `scale=`, `offsetX=`, `offsetY=` ja `debug=1` ovat edelleen käytettävissä.
- Tulostaulun pelikellossa ottelun päättymismerkintä on `LT` (ei enää `LOPPUTULOS`).
- Kokoonpanot-sivulla jokaisen joukkueen pelaajat näytetään yhdessä pystysarakkeessa. Grafiikka keskitetään näytön keskelle ja skaalataan tarvittaessa niin, että sisältö mahtuu ruutuun.


## Viimeisimmät layout-muutokset
- Kokoonpanot: oletusleveys 840 px (aiempi 1400 px, noin 40 % kapeampi) ja pelaajien nimiteksti 18,2 px (+30 % aiemmasta 14 px:stä). Grafiikka pysyy keskitettynä.
- Tulostaulu: oletussiirrot `offsetX=40`, `offsetY=30`.
- Vierasjoukkueen nimi on kohdistettu oman nimilaatikkonsa ulkoreunaan oikealle.
- Tehopelaajat: oletussiirrot `offsetX=40`, `offsetY=90`, eli tulostaulun 54 px korkean rivin ja 6 px välin alle.


## Uusimmat korjaukset (kokoonpanot ja sijoittelu)
- Kokoonpanot-grafiikan oletusleveys on 840 px (aiemman 1400 px sijasta, eli 40 % kapeampi). Jos osoitteessa annetaan `width=`, se korvaa oletuksen.
- Kokoonpanon pelaajanimet ovat 18,2 px (aiemmin 14 px) ja kapealla näkymällä 15,6 px (aiemmin 12 px), eli 30 % suuremmat molemmissa tapauksissa.
- Tulostaulun offset-oletus on X=40 px, Y=30 px. Tehopelaajien oletus on X=40 px, Y=90 px, eli 6 px tulostaulurivin (54 px) alapuolella, kun tulostaulun Y=30 px.
- Korjattu URL-parametrien lukeminen: puuttuva `offsetX`/`offsetY` ei enää muutu vahingossa nollaksi JavaScriptin `Number(null)`-muunnoksen takia. Annettu arvo, myös nolla, toimii edelleen yliajona.


## Korjaus: kokoonpanojen mitat ja oletussijainnit
- Kokoonpanosivun oletusleveys on 840 px. Tämä arvo on päivitetty sekä CSS:n alkuarvoon että sivun myöhemmin suorittamaan mitoitusskriptiin, joka aiemmassa paketissa palautti leveyden 1400 pikseliin. Ohjauspaneeli luo kokoonpanoille nyt myös URLin, jossa `width=840`, jos käyttäjä ei anna yleistä leveysarvoa.
- Pelaajien nimitekstit ovat 18,2 px normaalissa näkymässä (14 px × 1,3) ja 15,6 px kapeassa näkymässä (12 px × 1,3).
- Tulostaulun oletussiirto ilman URL-parametreja on X=40 px, Y=30 px. Tehopelaajien oletussiirto on X=40 px, Y=90 px. Korjaus estää `Number(null)`-muunnosta muuttamasta puuttuvaa parametria nollaksi.
- Huomaa: jos OBS:n vanha selainlähteen URL sisältää nimenomaan `width=1400` tai `offsetX=0&offsetY=0`, nuo eksplisiittiset arvot ohittavat oletukset. Päivitä URL ohjauspaneelista tai poista/korvaa vanhat parametrit.

## Kentälliset-grafiikka

`salibandy-kentalliset.html` näyttää ottelun kentälliset joukkueittain. Pelaajat ryhmitellään TorneoPalin `position`-kentän rivinumeron mukaan (esim. `VL/1`, `KH/1`), maalivahdit erotellaan omaksi ryhmäkseen, ja mukana ovat myös kokoonpanon toimihenkilöt sekä peliasutiedot, jos rajapinta palauttaa ne. Osoitteeseen voi lisätä `?match_id=939044`, `?width=1200`, `?height=1000`, `?scale=1`, `?offsetX=0&offsetY=0` tai `?preview=1` testidataa varten. Näkyvyyden etäohjaus käyttää omaa `lines`-avainta.

- `salibandy-kuntopuntari.html`: Kuntopuntari-grafiikka näyttää molempien joukkueiden viisi viimeisintä pelattua ottelua sekä viisi kauden tehokkainta pistemiestä. Otteluhistoria ja pelaajatilastot haetaan TorneoPalin REST-rajapinnasta palvelinreitin `/api/salibandy-form` kautta. Grafiikan oletusleveys on 1200 px; `match_id`, `width`, `height`, `scale`, `offsetX`, `offsetY` ja `refresh` ovat säädettävissä URL-parametreilla. `?preview=1` näyttää esimerkkidatan ja `?remote=1` kytkee sivun ohjauspaneelin näkyvyystilaan.


## Selostaja-grafiikka

Avaa `salibandy-selostaja.html`. Nimi vaihdetaan URL-parametrilla `name`, esimerkiksi `salibandy-selostaja.html?name=Maija%20Meik%C3%A4l%C3%A4inen`. Oletusnimi on Jussi Valli. Oletussijainti on 40 px ylhäältä ja 30 px oikealta. Valinnaiset parametrit: `width` (leveys pikseleinä), `scale` (skaalaus), `offsetY` (yläreuna pikseleinä) ja `offsetX` (oikea reuna pikseleinä).


## Erätauko-grafiikka

Avaa `salibandy-eratauko.html`. Oletusleveys on 1400 px. Joukkueiden logot ovat grafiikan ulkoreunoissa, nimet niiden sisäpuolella ja tulos keskellä keltaisessa suorakulmiossa. Grafiikka hakee automaattisesti valitun oletusottelun tiedot; ottelun voi ohittaa parametreilla `?match_id=OTTELUN_ID`, `width`, `scale`, `offsetX`, `offsetY` ja `refresh`. `?preview=1` näyttää esimerkin 5–3-tilanteesta. Jos haluat ohjata näkyvyyttä grafiikkaohjauksesta, lisää URL-parametri `remote=1`; grafiikan avain on `breaktime`.

Kentälliset-grafiikan oikean joukkueen nimi on tasattu oikealle logon viereen.

## getScore-nopeustestin virheiden tulkinta

`/api/salibandy-score?match_id=OTTELUN_ID` käyttää TorneoPalin `getScore`-kutsua. Rajapinnan dokumentaatioesimerkin mukaan vastaus voi sisältää `score`-olion ilman erillistä `call.status`-kenttää, joten testipalvelin ei edellytä `call.status`-kenttää. Jos tuloskenttiä ei silti löydy, virhevastauksessa näkyvät `rootKeys` ja rajattu `responsePreview`, joiden avulla vastausrakenne voidaan diagnosoida.
