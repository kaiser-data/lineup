# Third-party notices & attribution

Lineup (MIT-licensed, see [`LICENSE`](LICENSE)) is assembled from open-source
frameworks and assets. This file names each component and its license. Licenses
were read from the installed packages; where a component requires attribution
(notably the avatar designs and fonts that make up the **generated graphic**),
the credit is called out explicitly.

> Nothing here is a substitute for the upstream license texts — follow the
> linked projects for the authoritative terms.

## Generated-graphic assets (attribution required)

These produce the visible badge artwork, so their credits travel with any image
Lineup generates.

### Avatar designs — [DiceBear](https://dicebear.com)

The DiceBear **code** is MIT (© Florian Körner). Each avatar **style** is a
separate design with its own license:

| Style | Designer | Design license |
|---|---|---|
| `lorelei` *(default)* | Lisa Wischofsky | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (remix of the original) |
| `notionists` | Zoish | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (remix of the original) |
| `bottts` | Pablo Stanley | Free for personal and commercial use (remix of the original) |
| `shapes` | DiceBear | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

### Fonts

| Font | Author | License |
|---|---|---|
| **Inter** (`@fontsource/inter`, used by the Satori PNG renderer) | The Inter Project Authors | [SIL Open Font License 1.1](https://openfontlicense.org/) (OFL-1.1) |
| **Mozilla Text** (loaded in `src/index.css` via Google Fonts) | Mozilla | SIL Open Font License 1.1 (OFL-1.1) |

The OFL reserves the font names; the fonts may be bundled and embedded freely.

## Runtime frameworks & libraries

| Package | License | Project |
|---|---|---|
| `react`, `react-dom` | MIT | Meta |
| `@modelcontextprotocol/sdk` | MIT | Anthropic |
| `skybridge` | ISC | [Alpic Skybridge](https://docs.skybridge.tech) |
| `@alpic-ai/ui` | © Alpic (see package) | Alpic |
| `@dicebear/core`, `@dicebear/collection` | MIT | DiceBear |
| `qrcode` | MIT | [soldair/node-qrcode](https://github.com/soldair/node-qrcode) |
| `qrcode.react` | ISC | [zpao/qrcode.react](https://github.com/zpao/qrcode.react) |
| `ics` | ISC | [adamgibbons/ics](https://github.com/adamgibbons/ics) |
| `satori` | MPL-2.0 | [vercel/satori](https://github.com/vercel/satori) |
| `@resvg/resvg-js` | MPL-2.0 | [yisibl/resvg-js](https://github.com/yisibl/resvg-js) |
| `zod` | MIT | colinhacks |
| `sonner` | MIT | emilkowalski |
| `lucide-react` | ISC | Lucide |
| `tw-animate-css` | MIT | Wombosvideo |
| `vite` | MIT | Vite |
| `tailwindcss` | MIT | Tailwind Labs |

**MPL-2.0 components** (`satori`, `@resvg/resvg-js`) are used unmodified; their
source is available from the linked repositories. If you modify those files,
MPL-2.0 requires you to make the modified source available under MPL-2.0.

## Build & dev tooling

| Package | License |
|---|---|
| `typescript` | Apache-2.0 |
| `tsx` | MIT |
| `@tailwindcss/vite`, `@vitejs/plugin-react` | MIT |
| `@skybridge/devtools`, `alpic` | ISC |
| `@types/*` | MIT (DefinitelyTyped) |

---

*Generated and maintained by hand from `package.json` + installed package
metadata. To refresh: `npm ls --all` and re-check each package's `license`
field.*
