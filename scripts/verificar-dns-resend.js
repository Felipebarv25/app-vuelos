// Comprueba por DNS publico si un dominio esta listo para enviar con Resend.
//
//   node scripts/verificar-dns-resend.js anduve.com
//
// No necesita credenciales de nada: solo consulta DNS. Sirve para saber si los
// registros que Resend pide ya estan puestos y propagados, sin tener que entrar
// al panel. Resend usa un SUBDOMINIO de envio (send.<dominio>) para el MX y el
// SPF, de modo que el correo normal del dominio no se toca.
const dns = require("dns").promises;
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const dominio = (process.argv[2] || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
if (!dominio) {
  console.error("Uso: node scripts/verificar-dns-resend.js <dominio>");
  process.exit(1);
}
const sub = `send.${dominio}`;

async function txt(nombre) {
  try { return (await dns.resolveTxt(nombre)).map((p) => p.join("")); } catch { return []; }
}
async function mx(nombre) {
  try { return await dns.resolveMx(nombre); } catch { return []; }
}

(async () => {
  console.log(`Dominio: ${dominio}\n`);
  const filas = [];

  // 1) DKIM — el registro que firma los correos. Resend lo pide en
  //    resend._domainkey.<dominio>
  const dkim = await txt(`resend._domainkey.${dominio}`);
  filas.push(["DKIM", `resend._domainkey.${dominio}`,
    dkim.some((v) => /p=/.test(v)) ? "OK" : "FALTA",
    dkim[0] ? dkim[0].slice(0, 46) + "…" : "—"]);

  // 2) SPF del subdominio de envio: autoriza a Resend a enviar por send.<dominio>
  const spf = await txt(sub);
  const spfResend = spf.find((v) => /^v=spf1/i.test(v) && /resend/i.test(v));
  filas.push(["SPF", sub,
    spfResend ? "OK" : spf.some((v) => /^v=spf1/i.test(v)) ? "HAY SPF PERO SIN RESEND" : "FALTA",
    spfResend || spf[0] || "—"]);

  // 3) MX del subdominio de envio (rebotes)
  const mxSub = await mx(sub);
  filas.push(["MX", sub,
    mxSub.some((r) => /amazonses|resend/i.test(r.exchange)) ? "OK" : mxSub.length ? "HAY MX PERO NO ES DE RESEND" : "FALTA",
    mxSub.map((r) => `${r.priority} ${r.exchange}`).join(", ") || "—"]);

  const ancho = [6, Math.max(20, sub.length + 24), 26];
  for (const [tipo, nombre, estado, valor] of filas) {
    console.log(
      tipo.padEnd(ancho[0]) + nombre.padEnd(ancho[1]) +
      estado.padEnd(ancho[2]) + valor
    );
  }

  // Avisos sobre lo que ya existe en el dominio, para no romperlo.
  console.log("\n--- estado actual del correo del dominio ---");
  const mxRaiz = await mx(dominio);
  console.log(`  MX en la raiz: ${mxRaiz.length ? mxRaiz.map((r) => r.exchange).join(", ") : "ninguno"}`);
  if (mxRaiz.length) {
    console.log("    ^ hay buzon activo. Por eso Resend debe usar el subdominio");
    console.log("      de envio: tocar el MX de la raiz romperia ese correo.");
  }
  const spfRaiz = (await txt(dominio)).filter((v) => /^v=spf1/i.test(v));
  console.log(`  SPF en la raiz: ${spfRaiz.length ? spfRaiz.join(" | ") : "ninguno"}`);
  if (spfRaiz.length > 1) console.log("    ^ OJO: mas de un SPF es invalido, solo se permite uno.");
  const dmarc = await txt(`_dmarc.${dominio}`);
  console.log(`  DMARC: ${dmarc.length ? dmarc.join(" | ") : "ninguno"}`);

  const listo = filas.every(([, , estado]) => estado === "OK");
  console.log(`\n${listo ? "LISTO: los tres registros estan puestos. Ya se puede pulsar Verify en Resend." : "TODAVIA NO: falta al menos un registro (ver arriba)."}`);
  process.exitCode = listo ? 0 : 1;
})();
