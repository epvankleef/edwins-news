# CLAUDE.md

Dit bestand geeft richtlijnen aan Claude Code (claude.ai/code) bij het werken in deze repository.

## Projectoverzicht

**I News Digest** — een gepersonaliseerde AI-nieuwsdigest die leert van gebruikersfeedback. Nieuws wordt elke ochtend automatisch opgehaald, gescoord en opgeslagen; de gebruiker leest en beoordeelt artikelen; het AI-profiel verbetert zichzelf over tijd.

## Architectuur

```
n8n (automatisering) ──→ Supabase (PostgreSQL) ←── Next.js / React (Vercel)
          │                      ↑                          │
     GPT-4o-mini             REST API                   REST API
     (scoren +           (news_items,               (artikelen lezen,
    samenvatten)        user_profile,               POST feedback)
                        user_feedback)
```

### Stack
| Laag | Technologie |
|---|---|
| Automatisering / backend | n8n (self-hosted of cloud) |
| Database | Supabase (PostgreSQL + REST API, gratis tier) |
| AI | OpenAI GPT-4o-mini via n8n LangChain nodes |
| Frontend | Next.js (of statische React) op Vercel |
| Nieuwsbronnen | 23 feeds: RSS, NewsAPI, Hacker News API, Reddit JSON, ArXiv API |

### Supabase-tabellen
- **`news_items`** — gescoorde artikelen die elke ochtend worden opgeslagen (titel, samenvatting, bron, categorie, score 1–10, datum)
- **`user_profile`** — één rij met voorkeursprofiel (~200 woorden), wekelijks of op aanvraag bijgewerkt door AI
- **`user_feedback`** — beoordelingen per artikel: 👍 / 😐 / 👎, optionele tekstreden, tijdstempel

## n8n Flows

### Flow 1 — Ochtendnieuws (schema: 08:00 dagelijks)
1. Haal parallel nieuws op uit 23 bronnen (bedrijfsblogs, nieuwssites, AI-media, communities, aggregators, academisch)
2. Code node: normaliseer naar één schema → filter clickbait (regex) → verwijder duplicaten (Jaccard similarity fuzzy match) → filter op laatste 24 uur
3. Lees `user_profile` uit Supabase
4. GPT-4o-mini: score elk artikel 1–10 op basis van het profiel
5. INSERT 30–40 gescoorde artikelen in `news_items`

### Flow 2 — Profielupdate (twee triggers)
- **Wekelijks**: zondagschema
- **Op aanvraag**: webhook vanuit frontend, wordt alleen uitgevoerd bij 20+ nieuwe beoordelingen sinds de laatste update
1. Haal alle `user_feedback` op uit Supabase
2. GPT-4o-mini: vat samen tot ~200-woorden voorkeursprofiel (laatste 2 weken = dubbel gewicht)
3. UPSERT resultaat in `user_profile`

## Nieuwsbronnen (23 totaal)
- **Bedrijfsblogs**: OpenAI, Anthropic, Google, Meta, Microsoft, NVIDIA, Mistral, Hugging Face, Stability AI
- **Nieuwssites**: TechCrunch, The Verge, Ars Technica, Wired, VentureBeat, Reuters, MIT Tech Review
- **AI-media**: The Decoder, Marktechpost
- **Community**: Hacker News, Reddit
- **Aggregators**: NewsAPI, Google News
- **Academisch**: ArXiv

## Frontendgedrag
- Bij laden: `GET /rest/v1/news_items?date=today&order=score.desc&limit=10` → toon top 10
- Per artikel: titel, korte samenvatting, bron, categoriebadge, importantiescore
- Feedbackknoppen (👍 / 😐 / 👎) + optionele tekst → `POST /rest/v1/user_feedback`
- Na het plaatsen van feedback: controleer of er 20+ nieuwe beoordelingen zijn → activeer eventueel de profielupdate-webhook
- Geen server-side rendering vereist; de Supabase REST API wordt rechtstreeks vanuit de client aangeroepen

## Verificatieregel

Gebruik altijd de `superpowers:verification-before-completion` skill voordat je een taak als voltooid markeert. Voer tests, builds en/of linter uit en toon de daadwerkelijke output — claimen dat iets werkt zonder bewijs is niet toegestaan.

## Ontwerpkeuzes
- **Geen wachttijd**: nieuws is al opgehaald en gescoord voordat de gebruiker de app opent
- **Directe Supabase REST**: de frontend praat rechtstreeks met Supabase, geen eigen API-laag nodig
- **Profiel als platte tekst**: het AI-profiel is een ~200-woorden samenvatting in natuurlijke taal, geen gestructureerde data — makkelijker te evolueren
- **Feedbackdrempel**: profiel wordt pas opnieuw gegenereerd na 20+ nieuwe beoordelingen, om overfitting op weinig data te voorkomen
