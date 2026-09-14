# Christian Worship Lyrics, Chords & Media Web Application

A brand new, high-performance web application featuring all **3,773 Christian Worship songs** (Telugu, English, and Hindi) with real-time chords transposition, embedded audio/video playback, church projector presentation mode, and instant bilingual search.

---

## Key Features

- **Complete Song Catalog**:
  - **3,773 Total Songs** (Telugu: 3,344 | English: 396 | Hindi: 33)
  - **2,426 Songs with Audio/Video** (High-definition YouTube playback)
  - **148 Songs with Interactive Chords**
  - **3,500+ Songs with PowerPoint (PPT)** download links
- **Interactive Chord Engine**:
  - Line-by-line chords monospaced and color-coded directly above lyrics.
  - Real-time **Key Transposition** (+/- semitones with automatic sharp/flat adjustment).
  - Capo adjustment calculator and chord credits.
- **Bilingual & Dual Script Display**:
  - Native script (Telugu/Hindi) and English phonetic transliteration.
  - **Dual Mode**: Side-by-side split view showing original script alongside English transliteration for sing-along.
  - Font zoom controls (+/- px) for mobile, tablet, and desktop.
- **Embedded Audio & Video Player**:
  - Floating, non-intrusive docked media player.
  - Expandable video view or compact audio bar.
  - Auto-scroll button matching song tempo for hands-free singing.
- **Church Fullscreen Presentation Mode**:
  - Fullscreen display with high-contrast stanzas.
  - Keyboard arrow key navigation (`←`, `→`, `Space`, `PageUp`, `PageDown`).
  - Script toggle between native script and transliterated English.
- **Instant Client-Side Search**:
  - Sub-millisecond fuzzy search matching Telugu script, English transliterated spelling, or author names.
  - Alphabetical A-Z and native alphabet filtering.
- **Official Hymnal Collections**:
  - *Andhra Kraisthava Keerthanalu* (773 songs)
  - *Hosanna Ministries*
  - *Songs of Zion*
  - *Vidhyaarthi Geethaavali*
  - *Joyful Journey* (Main, Sunday School, Pallavulu, Choruses)

---

## Project Structure

```
ChristianLyricsWeb/
├── dist/                      # Production build output
├── public/
│   └── data/
│       ├── compact_index.json # Lightweight search index (1.75 MB for all 3,773 songs)
│       ├── songbooks.json     # All 8 official hymnal collections
│       └── songs/             # 3,773 individual song JSON detail files (<10 KB each)
├── src/
│   ├── components/
│   │   ├── Header.jsx         # Navigation, search bar, language/chords filter chips
│   │   ├── SongList.jsx       # Grid of song cards, pagination, alphabet scrubber
│   │   ├── SongDetail.jsx     # Dual-script lyrics, chord transposer, font scaler
│   │   ├── MediaPlayer.jsx    # Floating docked audio/video YouTube player
│   │   ├── SongbooksModal.jsx # Collection browser for official hymnals
│   │   └── PresentationModal.jsx # Fullscreen church projector display
│   ├── utils/
│   │   ├── chordTransposer.js # Chromatic transposition engine
│   │   └── search.js          # Bilingual fuzzy search and filtering
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## Getting Started

### Development
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

### Production Build
```bash
npm run build
npm run preview
```
The optimized static build will be placed in `dist/`.

---

## Deployment

The application is completely static and client-side:
- **GitHub Pages**: Deploy the `dist/` directory directly or via GitHub Actions.
- **Netlify / Vercel**: Connect the repository and set build command to `npm run build` with publish directory `dist`.
