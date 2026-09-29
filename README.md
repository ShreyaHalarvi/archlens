# ArchLens

Code-to-Diagram Architecture Visualizer for the GenAI / DevTools hackathon.

## Pipeline

GitHub repository → repository scanner → static analysis → concrete dependency evidence → Groq semantic architecture → Mermaid.js source → live diagram.

## Replace your project

Replace the project files with this bundle, then create `.env.local` from `.env.local.example`.

Do not commit `.env.local`.

## Run

```powershell
npm install
npm run dev
```

For a production build:

```powershell
npm run build
```

## Demo

Try:

- https://github.com/psf/requests
- https://github.com/expressjs/express

The UI exposes:

- Architecture diagram
- Concrete internal dependencies
- File/component Codebase Map
- Structural Risk Map
- Generated Mermaid.js source
- Copy Mermaid / Download `.mmd`
- AI architecture explanation
- Architecture Q&A

The analyzer does not execute repository code.
