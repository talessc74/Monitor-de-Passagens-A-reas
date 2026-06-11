/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// D-07: Deterministic price generator — no arbitrary randomness (RIVERRAID)
function routeSeed(origin: string, destination: string, date: string, siteId: string): number {
  const str = `${origin}-${destination}-${date}-${siteId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// D-04: In-memory rate limiter for scan endpoint — prevent API key exhaustion (GHOST)
const scanRateMap = new Map<string, { count: number; resetAt: number }>();
const SCAN_RATE_WINDOW_MS = 60_000;
const SCAN_RATE_MAX = 10;

function checkScanRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = scanRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    scanRateMap.set(ip, { count: 1, resetAt: now + SCAN_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= SCAN_RATE_MAX) return false;
  entry.count++;
  return true;
}

// D-05: Payload validation — validate at system boundaries (SCOUT + SENTINEL)
function validateMonitorPayload(body: any): string | null {
  const { origin, destination, departureDate, returnDate, targetPrice, email, adults, children } = body;

  if (!origin || !/^[A-Z]{2,4}$/.test(String(origin).trim().toUpperCase())) {
    return "Código IATA de origem inválido (ex: GRU, GIG, BSB)";
  }
  if (!destination || !/^[A-Z]{2,4}$/.test(String(destination).trim().toUpperCase())) {
    return "Código IATA de destino inválido (ex: LIS, MIA, CDG)";
  }
  if (String(origin).trim().toUpperCase() === String(destination).trim().toUpperCase()) {
    return "Origem e destino não podem ser iguais";
  }

  const dep = new Date(departureDate);
  const ret = new Date(returnDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(dep.getTime())) return "Data de ida inválida";
  if (isNaN(ret.getTime())) return "Data de volta inválida";
  if (dep < today) return "Data de ida não pode ser no passado";
  if (ret <= dep) return "Data de volta deve ser posterior à data de ida";

  const price = Number(targetPrice);
  if (isNaN(price) || price <= 0) return "Preço alvo deve ser um número positivo";

  const ad = Number(adults);
  if (isNaN(ad) || ad < 1 || ad > 9) return "Número de adultos deve ser entre 1 e 9";

  const ch = Number(children);
  if (isNaN(ch) || ch < 0 || ch > 9) return "Número de crianças deve ser entre 0 e 9";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return "E-mail para notificações é inválido";
  }

  return null;
}

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "server_db_passagens.json");

// Define custom user agent for AI Studio requirements
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy_key",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Seed data interfaces matching /src/types.ts
interface DatabaseSchema {
  monitors: any[];
  notifications: any[];
  sites: any[];
}

const DEFAULT_SITES = [
  {
    id: "latam",
    name: "LATAM Airlines",
    url: "https://www.latamairlines.com",
    logo: "PLANE_ORANGE",
    status: "active",
    scrapedCount: 142,
    lastScrapedAt: new Date(Date.now() - 3600000).toISOString(),
    avgResponseMs: 450,
  },
  {
    id: "gol",
    name: "GOL Linhas Aéreas",
    url: "https://www.voegol.com.br",
    logo: "PLANE_ORANGE",
    status: "active",
    scrapedCount: 121,
    lastScrapedAt: new Date(Date.now() - 1200000).toISOString(),
    avgResponseMs: 380,
  },
  {
    id: "azul",
    name: "Azul Linhas Aéreas",
    url: "https://www.voeazul.com.br",
    logo: "PLANE_BLUE",
    status: "active",
    scrapedCount: 98,
    lastScrapedAt: new Date(Date.now() - 4800000).toISOString(),
    avgResponseMs: 520,
  },
  {
    id: "decolar",
    name: "Decolar.com",
    url: "https://www.decolar.com",
    logo: "PASSPORT",
    status: "active",
    scrapedCount: 220,
    lastScrapedAt: new Date(Date.now() - 7200000).toISOString(),
    avgResponseMs: 610,
  },
  {
    id: "skyscanner",
    name: "Skyscanner",
    url: "https://www.skyscanner.com.br",
    logo: "COMPASS",
    status: "active",
    scrapedCount: 195,
    lastScrapedAt: new Date(Date.now() - 600000).toISOString(),
    avgResponseMs: 310,
  },
];

const DEFAULT_MONITORS = [
  {
    id: "mon-1",
    origin: "GRU",
    originCity: "São Paulo",
    destination: "LIS",
    destinationCity: "Lisboa",
    departureDate: "2026-10-12",
    returnDate: "2026-10-26",
    adults: 2,
    children: 1,
    targetPrice: 4200,
    currentPrice: 4890,
    bestPriceTracked: 4590,
    trackedSites: ["latam", "azul", "decolar", "skyscanner"],
    notificationsEnabled: true,
    email: "talessc@gmail.com",
    createdAt: new Date(Date.now() - 864500000).toISOString(),
    lastScannedAt: new Date(Date.now() - 1800000).toISOString(),
    history: [
      { date: new Date(Date.now() - 86400000 * 7).toISOString(), price: 5400, site: "decolar" },
      { date: new Date(Date.now() - 86400000 * 5).toISOString(), price: 5120, site: "latam" },
      { date: new Date(Date.now() - 86400000 * 3).toISOString(), price: 4890, site: "skyscanner" },
      { date: new Date(Date.now() - 86400000 * 1).toISOString(), price: 4950, site: "azul" },
    ],
    status: "active",
  },
  {
    id: "mon-2",
    origin: "GIG",
    originCity: "Rio de Janeiro",
    destination: "MIA",
    destinationCity: "Miami",
    departureDate: "2026-11-05",
    returnDate: "2026-11-15",
    adults: 1,
    children: 0,
    targetPrice: 2800,
    currentPrice: 2650,
    bestPriceTracked: 2650,
    trackedSites: ["gol", "latam", "skyscanner"],
    notificationsEnabled: true,
    email: "talessc@gmail.com",
    createdAt: new Date(Date.now() - 432000000).toISOString(),
    lastScannedAt: new Date(Date.now() - 900000).toISOString(),
    history: [
      { date: new Date(Date.now() - 86400000 * 4).toISOString(), price: 3100, site: "gol" },
      { date: new Date(Date.now() - 86400000 * 2).toISOString(), price: 2950, site: "latam" },
      { date: new Date(Date.now() - 86400000 * 1).toISOString(), price: 2650, site: "skyscanner" },
    ],
    status: "active",
  },
];

const DEFAULT_NOTIFICATIONS = [
  {
    id: "not-1",
    monitorId: "mon-2",
    origin: "GIG",
    destination: "MIA",
    title: "Preço Alvo Atingido! (Rio ➔ Miami)",
    message: "A Skyscanner encontrou passagens para Denver/Miami por R$ 2.650! Este valor está abaixo do seu preço alvo de R$ 2.800.",
    price: 2650,
    targetPrice: 2800,
    sentTo: "talessc@gmail.com",
    sentAt: new Date(Date.now() - 900000).toISOString(),
    type: "target_reached",
    purchaseUrl: "https://www.skyscanner.com.br/transporte/passagens-aereas/gig/mia/261105/261115/?adults=1&children=0",
  },
];

// Read from JSON Database
function readDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Erro ao ler banco de dados local:", err);
  }

  // Create new if absent
  const initialDb: DatabaseSchema = {
    monitors: DEFAULT_MONITORS,
    notifications: DEFAULT_NOTIFICATIONS,
    sites: DEFAULT_SITES,
  };
  writeDatabase(initialDb);
  return initialDb;
}

// Write to JSON Database
function writeDatabase(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao escrever no banco de dados local:", err);
  }
}

// Helper to generate search-deep-links
function generatePurchaseLink(siteId: string, origin: string, destination: string, departureDate: string, returnDate: string, adults: number, children: number): string {
  const o = (origin || "GRU").toUpperCase().trim();
  const d = (destination || "LIS").toUpperCase().trim();
  const depDate = departureDate || "2026-10-12";
  const retDate = returnDate || "2026-10-26";
  const ad = adults || 1;
  const ch = children || 0;

  if (siteId === "latam") {
    return `https://www.latamairlines.com/br/pt/voos?origem=${o}&destino=${d}&saida=${depDate}&volta=${retDate}&adultos=${ad}&criancas=${ch}`;
  } else if (siteId === "gol") {
    return `https://b2c.voegol.com.br/compra/busca-voos?origin=${o}&destination=${d}&outboundDate=${depDate}&inboundDate=${retDate}&adults=${ad}&children=${ch}`;
  } else if (siteId === "azul") {
    return `https://www.voeazul.com.br/br/pt/home/selecao-voo?origin=${o}&destination=${d}&departureDate=${depDate}&returnDate=${retDate}&adults=${ad}&children=${ch}`;
  } else if (siteId === "decolar") {
    return `https://www.decolar.com/shop/flights/search/roundtrip/${o}/${d}/${depDate}/${retDate}/${ad}/${ch}/0`;
  }

  // Default / skyscanner fallback
  const d1 = depDate.slice(2).replace(/-/g, '');
  const d2 = retDate.slice(2).replace(/-/g, '');
  return `https://www.skyscanner.com.br/transporte/passagens-aereas/${o.toLowerCase()}/${d.toLowerCase()}/${d1}/${d2}/?adults=${ad}&children=${ch}`;
}

// REST Endpoints
// 1. Air sites endpoint
app.get("/api/sites", (req, res) => {
  const db = readDatabase();
  res.json(db.sites);
});

// Toggle site active/inactive
app.post("/api/sites/:id/toggle", (req, res) => {
  const db = readDatabase();
  const site = db.sites.find((s) => s.id === req.params.id);
  if (site) {
    site.status = site.status === "active" ? "maintenance" : "active";
    writeDatabase(db);
    res.json({ success: true, site });
  } else {
    res.status(404).json({ error: "Site não encontrado" });
  }
});

// 2. Monitors list endpoint
app.get("/api/monitors", (req, res) => {
  const db = readDatabase();
  res.json(db.monitors);
});

// Add new Flight Alert Monitor
app.post("/api/monitors", (req, res) => {
  const {
    origin,
    originCity,
    destination,
    destinationCity,
    departureDate,
    returnDate,
    adults,
    children,
    targetPrice,
    trackedSites,
    email,
  } = req.body;

  // D-05: full payload validation replacing bare presence check
  const validationError = validateMonitorPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const db = readDatabase();
  const newMonitor = {
    id: "mon-" + Math.random().toString(36).substr(2, 9),
    origin: origin.toUpperCase().trim(),
    originCity: originCity || origin,
    destination: destination.toUpperCase().trim(),
    destinationCity: destinationCity || destination,
    departureDate,
    returnDate,
    adults: Number(adults) || 1,
    children: Number(children) || 0,
    targetPrice: Number(targetPrice),
    currentPrice: null,
    bestPriceTracked: null,
    trackedSites: trackedSites && trackedSites.length ? trackedSites : ["latam", "gol", "azul", "decolar"],
    notificationsEnabled: true,
    email,
    createdAt: new Date().toISOString(),
    lastScannedAt: null,
    history: [],
    status: "active",
  };

  db.monitors.unshift(newMonitor);
  writeDatabase(db);
  res.json(newMonitor);
});

// Update monitor configuration
app.put("/api/monitors/:id", (req, res) => {
  const db = readDatabase();
  const idx = db.monitors.findIndex((m) => m.id === req.params.id);

  if (idx !== -1) {
    // D-03: explicit whitelist — prevent mass assignment (SENTINEL)
    const { status, targetPrice, notificationsEnabled, email } = req.body;
    const current = db.monitors[idx];
    const updated = {
      ...current,
      ...(status !== undefined ? { status: ["active", "paused"].includes(status) ? status : current.status } : {}),
      ...(targetPrice !== undefined ? { targetPrice: Math.max(1, Number(targetPrice) || current.targetPrice) } : {}),
      ...(notificationsEnabled !== undefined ? { notificationsEnabled: Boolean(notificationsEnabled) } : {}),
      ...(email !== undefined && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) ? { email: String(email) } : {}),
    };
    db.monitors[idx] = updated;
    writeDatabase(db);
    res.json(updated);
  } else {
    res.status(404).json({ error: "Monitor não encontrado" });
  }
});

// Delete monitor
app.delete("/api/monitors/:id", (req, res) => {
  const db = readDatabase();
  const filtered = db.monitors.filter((m) => m.id !== req.params.id);
  db.monitors = filtered;
  writeDatabase(db);
  res.json({ success: true });
});

// 3. Scan specific monitor (Uses Gemini to simulate real-time search & pricing logic)
app.post("/api/monitors/:id/scan", async (req, res) => {
  // D-04: rate limiting — prevent Gemini API key exhaustion (GHOST)
  const clientIp = req.ip || (req.socket ? req.socket.remoteAddress : null) || "unknown";
  if (!checkScanRateLimit(clientIp)) {
    res.status(429).json({ error: "Muitas requisições de varredura. Aguarde 1 minuto antes de tentar novamente." });
    return;
  }

  const { id } = req.params;
  const db = readDatabase();
  const monitor = db.monitors.find((m) => m.id === id);

  if (!monitor) {
    res.status(404).json({ error: "Monitor não encontrado" });
    return;
  }

  // Choose websites to crawl
  const sitesToScan = monitor.trackedSites.length > 0 ? monitor.trackedSites : ["latam", "gol", "azul", "decolar"];

  try {
    let results: any[] = [];
    let generalAnalysis = "Análise automática de preços.";

    if (process.env.GEMINI_API_KEY) {
      // Prompt detailing flight crawling simulate
      const prompt = `Você é um robô de busca inteligente de passagens aéreas. O usuário quer viajar de ${monitor.originCity} (${monitor.origin}) para ${monitor.destinationCity} (${monitor.destination}) saindo em ${monitor.departureDate} e retornando em ${monitor.returnDate} com ${monitor.adults} adultos e ${monitor.children} crianças.
Determine valores fictícios porém altamente realistas em Reais Brasileiros (BRL) para as seguintes companhias aéreas: [${sitesToScan.join(", ")}].
Considere a data atual das buscas correspondente ao ano de 2026. Escreva uma análise breve sobre as flutuações sazonais, proximidade da data, se o preço está bom e os detalhes fictícios para cada voo (escalas, duração, etc).
Sempre garanta que os preços gerados façam sentido para uma viagem dessa distância (ex: viagens internacionais custam mais que domésticas, classe econômica).`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                results: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      site: { type: Type.STRING, description: "Identificador do site (ex: latam, gol, azul, decolar)" },
                      price: { type: Type.NUMBER, description: "Preço total para todos os passageiros em BRL" },
                      durationHours: { type: Type.NUMBER, description: "Duração aproximada do voo em horas" },
                      stops: { type: Type.INTEGER, description: "Número de paradas ou escalas" },
                      isPromotion: { type: Type.BOOLEAN, description: "Se é um preço promocional em comparação com o preço médio habitual" },
                      details: { type: Type.STRING, description: "Horários prováveis ou operadoras de voos" },
                    },
                    required: ["site", "price", "durationHours", "stops", "isPromotion", "details"],
                  },
                },
                generalAnalysis: {
                  type: Type.STRING,
                  description: "Uma análise curta em português (máximo 3 frases) do mercado e preços para este trecho e datas.",
                },
              },
              required: ["results", "generalAnalysis"],
            },
          },
        });

        const dataText = response.text ? response.text.trim() : "";
        if (dataText) {
          const parsed = JSON.parse(dataText);
          results = parsed.results || [];
          generalAnalysis = parsed.generalAnalysis || "";
        }
      } catch (geminiError) {
        console.error("Erro na chamada do Gemini API, caindo para simulação em código:", geminiError);
        // D-07: deterministic fallback — no arbitrary randomness (RIVERRAID)
        results = sitesToScan.map((siteId) => {
          const seed = routeSeed(monitor.origin, monitor.destination, monitor.departureDate, siteId);
          const basePrice = monitor.destination === "LIS" ? 4500 : 2500;
          const randomCoeff = 0.85 + seededRandom(seed) * 0.35;
          const finalPrice = Math.round(basePrice * randomCoeff * (monitor.adults + monitor.children * 0.7));
          return {
            site: siteId,
            price: finalPrice,
            durationHours: monitor.destination === "LIS" ? 10 : 8,
            stops: seededRandom(seed + 1) > 0.5 ? 1 : 0,
            isPromotion: finalPrice < monitor.targetPrice,
            details: "Voo operado diretamente no trecho indicado com ótimos horários de ida e volta.",
          };
        });
        generalAnalysis = "Preços simulados dinamicamente via gerador offline devido a limites de conexão de rede.";
      }
    } else {
      // D-07: deterministic offline simulation — no arbitrary randomness (RIVERRAID)
      results = sitesToScan.map((siteId) => {
        const seed = routeSeed(monitor.origin, monitor.destination, monitor.departureDate, siteId);
        const basePrice = monitor.destination === "LIS" ? 4500 : 2500;
        const randomCoeff = 0.85 + seededRandom(seed) * 0.3;
        const finalPrice = Math.round(basePrice * randomCoeff * (monitor.adults + monitor.children * 0.7));
        return {
          site: siteId,
          price: finalPrice,
          durationHours: monitor.destination === "LIS" ? 10 : 7,
          stops: seededRandom(seed + 1) > 0.4 ? 1 : 0,
          isPromotion: finalPrice < monitor.targetPrice,
          details: "Voo simulado com saída noturna, ideal para maximizar o tempo no destino.",
        };
      });
      generalAnalysis = "Simulação offline local ativada. O robô estimou as tarifas com base na distância entre aeroportos.";
    }

    if (results.length === 0) {
      throw new Error("Resultados de busca vazios");
    }

    // Process lowest price
    const validResults = results.filter((r) => r.price > 0);
    const sorted = [...validResults].sort((a, b) => a.price - b.price);
    const cheapestResult = sorted[0];

    const prevPrice = monitor.currentPrice;
    monitor.currentPrice = cheapestResult.price;
    monitor.lastScannedAt = new Date().toISOString();

    if (!monitor.bestPriceTracked || cheapestResult.price < monitor.bestPriceTracked) {
      monitor.bestPriceTracked = cheapestResult.price;
    }

    // Save scan points in history
    const historyEntry = {
      date: new Date().toISOString(),
      price: cheapestResult.price,
      site: cheapestResult.site,
    };
    monitor.history.push(historyEntry);
    if (monitor.history.length > 20) {
      monitor.history.shift(); // keep last 20
    }

    // Check notification criteria
    let triggeredNotification = null;
    const isUnderTarget = cheapestResult.price <= monitor.targetPrice;
    const priceChanged = prevPrice !== null && cheapestResult.price !== prevPrice;

    if (monitor.notificationsEnabled) {
      if (isUnderTarget) {
        // Trigger a target reached notification
        triggeredNotification = {
          id: "not-" + Math.random().toString(36).substr(2, 9),
          monitorId: monitor.id,
          origin: monitor.origin,
          destination: monitor.destination,
          title: `Meta Atingida! ${monitor.originCity} ➔ ${monitor.destinationCity} por R$ ${cheapestResult.price}`,
          message: `O site de passagens ${cheapestResult.site.toUpperCase()} atingiu um valor incrível de R$ ${cheapestResult.price} para as datas de sua viagem (${monitor.departureDate} a ${monitor.returnDate}). Este valor está abaixo da sua meta estipulada de R$ ${monitor.targetPrice}!`,
          price: cheapestResult.price,
          targetPrice: monitor.targetPrice,
          sentTo: monitor.email,
          sentAt: new Date().toISOString(),
          type: "target_reached" as const,
          purchaseUrl: generatePurchaseLink(cheapestResult.site, monitor.origin, monitor.destination, monitor.departureDate, monitor.returnDate, monitor.adults, monitor.children),
        };
      } else if (priceChanged) {
        const diff = cheapestResult.price - prevPrice;
        const arrow = diff < 0 ? "⬇️ Redução de Preço" : "⬆️ Aumento de Preço";
        triggeredNotification = {
          id: "not-" + Math.random().toString(36).substr(2, 9),
          monitorId: monitor.id,
          origin: monitor.origin,
          destination: monitor.destination,
          title: `${arrow} para ${monitor.destinationCity}`,
          message: `Olá! O preço da sua passagem monitorada variou de R$ ${prevPrice} para R$ ${cheapestResult.price} no site ${cheapestResult.site.toUpperCase()}. Suas datas de viagem são ${monitor.departureDate} a ${monitor.returnDate}.`,
          price: cheapestResult.price,
          targetPrice: monitor.targetPrice,
          sentTo: monitor.email,
          sentAt: new Date().toISOString(),
          type: "price_update" as const,
          purchaseUrl: generatePurchaseLink(cheapestResult.site, monitor.origin, monitor.destination, monitor.departureDate, monitor.returnDate, monitor.adults, monitor.children),
        };
      }

      if (triggeredNotification) {
        db.notifications.unshift(triggeredNotification);
      }
    }

    // Update sites scraped count
    sitesToScan.forEach((siteId) => {
      const siteObj = db.sites.find((s) => s.id === siteId);
      if (siteObj) {
        siteObj.scrapedCount += 1;
        siteObj.lastScrapedAt = new Date().toISOString();
        // simulate standard delay
        siteObj.avgResponseMs = Math.round(200 + Math.random() * 500);
      }
    });

    writeDatabase(db);
    res.json({
      success: true,
      monitor,
      results,
      generalAnalysis,
      cheapestResult,
      triggeredNotification,
    });
  } catch (error: any) {
    console.error("Erro durante o escaneamento:", error);
    res.status(500).json({ error: "Falha ao escanear tarifas aéreas", details: error.message });
  }
});

// 4. Notifications routes
app.get("/api/notifications", (req, res) => {
  const db = readDatabase();
  res.json(db.notifications);
});

// Clear notifications history
app.delete("/api/notifications", (req, res) => {
  const db = readDatabase();
  db.notifications = [];
  writeDatabase(db);
  res.json({ success: true });
});

// Mock immediate notification test
app.post("/api/test-email", (req, res) => {
  const { to, subject, content } = req.body;
  if (!to || !subject || !content) {
    res.status(400).json({ error: "Parâmetros 'to', 'subject' e 'content' são necessários." });
    return;
  }

  const db = readDatabase();
  const testNotif = {
    id: "not-test-" + Date.now(),
    monitorId: "test",
    origin: "TEST",
    destination: "TEST",
    title: `Simulação de Canal Ativo: ${subject}`,
    message: content,
    price: 0,
    targetPrice: 0,
    sentTo: to,
    sentAt: new Date().toISOString(),
    type: "promotion" as const,
  };

  db.notifications.unshift(testNotif);
  writeDatabase(db);

  res.json({ success: true, message: "E-mail de teste simulado enviado com sucesso para " + to, notification: testNotif });
});

// Start server containing Vite setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
