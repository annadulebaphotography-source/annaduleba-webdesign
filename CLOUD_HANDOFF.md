# Anna Duleba Digital Atelier - handoff dla Claude/Cloud

Projekt: statyczna strona HTML/CSS/vanilla JS dla marki Anna Duleba Digital Atelier.
Jezyk strony: niemiecki.
Folder projektu: `C:\Users\ankad\Documents\annaduleba-webdesign`

## Co jest zrobione

- Strona glowne `index.html` z premium hero, logo, animowanym tlem canvas inspirowanym logo.
- Podstrony: `angebot.html`, `worum.html`, `galerie.html`, `ueber-mich.html`, `kontakt.html`.
- Wspolny header i footer ladowany przez `main.js`.
- Styl marki w `styles.css`: jasne tlo, mauve/lavender, minimalistyczny premium wyglad.
- Kontakt zawiera:
  - telefon: `01570 5785865`
  - e-mail: `studio@annaduleba-webdesign.de`
  - adres: `Friedhofstr. 10, 75045 Walzbachtal`
- Firebase podlaczony w `firebase.js` do osobnego projektu `annaduleba-webdesign`.
- Mini CMS:
  - `content.js` laduje teksty i obrazy z Firestore/lokalnego cache.
  - `admin.js` obsluguje logowanie admina, edycje tekstow, upload zdjec, przesuwanie kadru zdjecia.
  - Dozwolone adresy admina:
    - `annadulebaphotography@gmail.com`
    - `studio@annaduleba-webdesign.de`
- Dodane reguly bezpieczenstwa:
  - `firestore.rules`
  - `storage.rules`
  - `firebase.json`
- W galerii i na stronie glownej sa pola na zdjecia, ktore admin moze zmieniac.
- Upload zdjec zostal przeniesiony z Firebase Storage do Cloudinary:
  - cloud name: `dqmda8upo`
  - unsigned upload preset: `anna_cms_unsigned`
  - asset folder w Cloudinary: `annaduleba-webdesign`
- Firebase Storage nie jest juz uzywany w kodzie strony.
- Firestore zostaje do logowania/admin CMS i zapisu URL-i zdjec oraz tekstow.
- Firestore Database zostala utworzona w projekcie `annaduleba-webdesign`.
- Firestore rules zostaly opublikowane w Firebase Console.
- Po F5 zdjecia nie znikaja: `content.js` laduje najpierw lokalny cache, a dopiero potem probuje Firestore.
- Zapis i odczyt Firestore maja timeout, zeby panel admina nie wisial bez konca, kiedy Firebase odpowiada wolno.

## Co wymaga sprawdzenia / poprawy

1. Zapis online przez Firestore trzeba jeszcze potwierdzic po finalnym tescie:
   - w konsoli powinno pojawiac sie `[CMS] Firestore save success`;
   - jesli dalej pojawi sie timeout, lokalny fallback dziala, ale trzeba bedzie dalej diagnozowac Firestore/Auth.

2. Admin powinien byc dostepny tylko dla konkretnych e-maili.
   - Frontend juz blokuje inne konta Google.
   - Prawdziwe zabezpieczenie jest w regule Firestore.

3. Panel admina na mobile.
   - Zostal zmniejszony i czesciowo dostosowany, ale warto jeszcze sprawdzic na telefonie, czy nie zaslania tresci.

4. Teksty.
   - Teksty sa robocze, niemieckie.
   - Anna chce je pozniej poprawic tak, zeby byly bardziej ludzkie i mniej sztywne.

5. Menu.
   - Menu webdesignowe jest inne niz w Reiki, ale warto finalnie sprawdzic nazwy i kolejnosc.

## Pliki kluczowe

- `index.html` - start / hero / sekcje glowne.
- `styles.css` - prawie caly wyglad strony.
- `main.js` - header/footer i animacja canvas hero.
- `content.js` - ladowanie tresci CMS.
- `admin.js` - panel admina, logowanie, upload i przesuwanie zdjec.
- `firebase.js` - konfiguracja Firebase.
- `galerie.html` - branding gallery z polami na zdjecia.
- `kontakt.html` - kontakt i formularz.
- `firestore.rules` / `storage.rules` - zabezpieczenia do wdrozenia.

## Uwaga o VS Code

Jesli VS Code pokazuje niezapisane zmiany, trzeba przed dalsza praca zapisac wszystkie pliki (`Ctrl+K S` albo File -> Save All). Z poziomu kodu nie widac pewnie, ktory plik jest aktualnie niezapisany w edytorze.
