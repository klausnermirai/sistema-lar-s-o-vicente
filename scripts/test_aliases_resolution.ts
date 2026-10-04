import fs from "fs";

function testAliasesResolution() {
  console.log("==========================================================================");
  console.log("=== ANÁLISE DE IMPACTO: BUSCA POR CHAVE ÚNICA VS ALIASES UNIFICADOS ===");
  console.log("==========================================================================");

  const rawFallback = fs.readFileSync("./db_fallback.json", "utf-8");
  const dbJson = JSON.parse(rawFallback);

  const monteAltoAliases = ["52.853.397/0001-68", "ga6jzrx1flf", "52853397000168", "52.384.815/0001-80"];

  console.log("\n1. Verificando onde estão os dados de Monte Alto no banco:");
  for (const [colName, colData] of Object.entries(dbJson)) {
    if (typeof colData === 'object' && colData !== null) {
      const items = Object.values(colData as any);
      const byGa6 = items.filter((it: any) => it.institutionId === "ga6jzrx1flf" || it.id === "ga6jzrx1flf");
      const byCnpj = items.filter((it: any) => it.institutionId === "52.853.397/0001-68" || it.id === "52.853.397/0001-68" || it.cnpj === "52.853.397/0001-68");
      
      if (byGa6.length > 0 || byCnpj.length > 0) {
        console.log(`\n -> Coleção [${colName}]:`);
        console.log(`    - Gravados com ID antigo ("ga6jzrx1flf"): ${byGa6.length}`);
        console.log(`    - Gravados com CNPJ ("52.853.397/0001-68"): ${byCnpj.length}`);
        console.log(`    - TOTAL combinando aliases: ${items.filter((it: any) => monteAltoAliases.includes(it.institutionId) || monteAltoAliases.includes(it.id) || monteAltoAliases.includes(it.cnpj)).length}`);
      }
    }
  }
}

testAliasesResolution();
