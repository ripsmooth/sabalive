# Salibandy-TV – GitHub Pages + Vercel API-välityspalvelin

Grafiikat julkaistaan edelleen GitHub Pagesissa. Vercel toimii vain TorneoPal-yhteyden palvelinpuolisena välityspalvelimena, jolloin selain ei enää kutsu TorneoPalin rajapintaa suoraan eikä TorneoPalin CORS-asetus estä hakua.

## 1. Julkaise Vercel-välityspalvelin

1. Vie tämän ZIP-paketin sisältö samaan GitHub-repositorioon, josta GitHub Pages julkaisee grafiikat.
2. Luo Vercelissä uusi projekti ja yhdistä sama GitHub-repositorio.
3. Aseta Vercelin projektin Root Directoryksi repositorion juuri (kansio, jossa `vercel.json` ja `api/` ovat).
4. Lisää Vercelin **Settings → Environment Variables** -kohtaan nämä kaksi muuttujaa:

   - `TORNEOPAL_HASH_SEED` = TorneoPalin SHA-256-hashissa käytettävä salainen merkkijono
   - `TORNEOPAL_ACCEPT` = TorneoPalin käyttämä Accept-arvo

   Käytä samoja arvoja kuin toimivassa TorneoPal-yhteydessä. Älä lisää näitä arvoja julkisiin HTML- tai JavaScript-tiedostoihin.

5. Tallenna muuttujat ja tee Verceliin uusi deployment.
6. Testaa Vercelin osoitteessa esimerkiksi:

   `https://OMA-PROJEKTI.vercel.app/api/torneopal?method=getMatch&match_id=953141`

   Onnistunut vastaus on JSON-dataa, jossa on `match`-kenttä ja `call.status` on `ok`.

## 2. Kytke GitHub Pages käyttämään Verceliä

Avaa `github-pages-api.js` ja vaihda tämän rivin osoite Vercelin antamaan projektiosoitteeseen:

```js
const API_BASE = 'https://YOUR-VERCEL-PROJECT.vercel.app';
```

Esimerkiksi:

```js
const API_BASE = 'https://sabalive-api.vercel.app';
```

Tallenna tiedosto ja julkaise GitHub Pages uudelleen. Kaikki tämän paketin grafiikat käyttävät yhteistä `github-pages-api.js`-tiedostoa, joten yhtä osoitemuutosta ei tarvitse tehdä jokaiseen grafiikkaan.

## 3. Testaus

1. Avaa ensin `salibandy-getscore-getmatch-nopeustesti.html`.
2. Avaa sitten `salibandy-tulostaulu.html?match_id=953141&debug=1`.
3. Jos haku ei onnistu, katso virheilmoitus. Jos se kertoo puuttuvista Vercel-ympäristömuuttujista, lisää ne Vercelin asetuksiin ja julkaise uudelleen.

## Huomioita

- GitHub Pages vastaa edelleen grafiikoiden HTML-, CSS- ja JavaScript-tiedostoista.
- Vercel käsittelee vain TorneoPal API-pyynnöt ja SHA-256-hashin.
- Vercel-funktio sallii vain tässä projektissa tarvittavat TorneoPal-metodit: `getMatch`, `getScore`, `getGroups`, `getCategory` ja `getMatches`.
- Ohjauspaneelin paikalliset asetukset tallentuvat edelleen selaimen `localStorage`-muistiin. Ne eivät synkronoidu eri selainten tai laitteiden välillä.
- Tämä paketti ei sisällä Vercelin ympäristömuuttujien arvoja. Ne lisätään Vercelin hallintapaneelissa.
