import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // API Route for Gemini Proxy
  app.post("/api/gemini", async (req, res) => {
    try {
      const { TargetModel, prompt, isStream, config, systemInstruction } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];

      if (!apiKey) {
        return res.status(401).json({ error: "No Gemini API key provided" });
      }

      if (!TargetModel) {
        return res.status(400).json({ error: "TargetModel is required" });
      }

      const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
      const method = isStream ? "streamGenerateContent" : "generateContent";
      const url = `${baseUrl}/models/${TargetModel}:${method}?key=${apiKey}`;

      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: config,
        systemInstruction: systemInstruction ? { parts: [{ text: typeof systemInstruction === 'string' ? systemInstruction : (systemInstruction as any).text }] } : undefined
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Referer": "https://aistudio.google.com/",
          "Origin": "https://aistudio.google.com/",
          "x-goog-api-client": "aistudio-build",
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: { message: errorText } };
        }
        console.error(`Gemini API Proxy Error (${TargetModel}):`, errorData);
        return res.status(response.status).json({ 
          error: errorData.error?.message || "Gemini API Error",
          details: errorData
        });
      }

      if (isStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          let braceCount = 0;
          let startIdx = -1;
          
          for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === '{') {
              if (braceCount === 0) startIdx = i;
              braceCount++;
            } else if (buffer[i] === '}') {
              braceCount--;
              if (braceCount === 0 && startIdx !== -1) {
                const chunkStr = buffer.substring(startIdx, i + 1);
                try {
                  const chunk = JSON.parse(chunkStr);
                  const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    res.write(`data: ${JSON.stringify({ text })}\n\n`);
                  }
                } catch (e) {}
                buffer = buffer.substring(i + 1);
                i = -1; 
                startIdx = -1;
              }
            }
          }
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const data: any = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.error("No text in response:", data);
            return res.status(500).json({ error: "Empty response from Gemini", details: data });
        }
        res.json({ text });
      }
    } catch (error: any) {
      console.error("Gemini Proxy Exception:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
