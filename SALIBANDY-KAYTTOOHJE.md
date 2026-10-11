SALIBANDY-OVERLAYT — KÄYTTÖÖNOTTO

Tämä on lisäosa nykyiseen BandyLive/Vercel-projektiin. Paketti sisältää vain uusia tiedostoja; se ei korvaa tai muuta nykyisiä jääpallon tiedostoja. API käyttää Salibandyliiton TorneoPal-rajapinnan getMatch-kutsua ja sen match.lineups-, match.goals-, match.bookings- ja match.events-tietoja.

TIEDOSTOT
- salibandy-tulostaulu.html
- salibandy-lowerthird.html
- salibandy-tilastot.html
- salibandy-kokoonpanot.html
- salibandy-grafiikkaohjaus.html
- api/salibandy-match.js
- api/salibandy-graphics-state.js

KÄYTTÖÖNOTTO
1. Pura ZIP ja kopioi sen HTML-tiedostot nykyisen Vercel-projektin juureen.
2. Kopioi kaksi uutta API-tiedostoa nykyisen projektin api-kansioon. Älä korvaa vanhoja API-tiedostoja.
3. Julkaise projekti uudelleen.
4. Avaa /salibandy-grafiikkaohjaus.html. Ottelun ID on oletuksena 953141.
5. Jos käytät etäohjausta, syötä nykyinen GRAPHICS_CONTROL_PASSWORD ja varmista, että projektissa ovat jo asetettuina UPSTASH_REDIS_REST_URL ja UPSTASH_REDIS_REST_TOKEN.
6. Kopioi halutun grafiikan osoite OBS:n selainlähteeseen.

URL-PARAMETRIT
- match_id tai ottelu: TorneoPal-ottelun tunnus (oletus 953141)
- scale: skaalaus 0.5–2.5 (oletus 1)
- width: grafiikan leveys pikseleinä, 500–1920 (oletus 1400; tulostaulun perusleveys 575 px)
- refresh: tietojen päivitysväli 3–60 sekuntia (oletus 3)

GRAFIIKAT
- Tulostaulu näyttää joukkueet, logot, tuloksen ja ottelun tilan/kellon.
- Lower Third listaa maalintekijät kummankin joukkueen omassa sarakkeessa. Pelaajan useampi maali ryhmitetään samalle riville.
- Tilastot näyttää tilastoidut laukaukset, maalivahdin torjunnat, jäähyminuutit ja jäähyjen määrän. Ulosajorivi piilotetaan, ellei ulosajoa löydy kirjatuista rangaistustiedoista.
- Kokoonpanot näyttää ottelun lineups-datan pelaajat rinnakkain; kapteenit ja maalivahdit merkitään, jos tieto on API-vastauksessa.
- Näkyvyyden vaihto käyttää 0,45 sekunnin opacity-häivytystä ja erillistä Redis-avainta "salibandy:graphics:visibility", jotta jääpallon ohjaustila pysyy erillään.

HUOMAUTUS TILASTOISTA
TorneoPal palauttaa nollia myös tilastoihin, joita kyseisessä ottelussa ei välttämättä ole erikseen kirjattu. Laukaus- ja torjuntaluvut näytetään API:n tilastotietojen summana; ne eivät ole laskennallisesti pääteltävissä pelkistä maaleista.
