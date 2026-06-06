import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  process.stdout.write("[test] Starting...\n");
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  process.stdout.write("[test] Querying rules...\n");
  
  const { data, error } = await supabase
    .from("policy_rules")
    .select("id, rule_code")
    .eq("is_active", true)
    .is("detection_sql", null);
  
  process.stdout.write(`[test] Rules: ${data?.length ?? 0}, error: ${error?.message ?? "none"}\n`);
  process.stdout.write(`[test] Rule codes: ${data?.map(r => r.rule_code).join(", ")}\n`);
}

main().catch(e => { process.stderr.write(String(e) + "\n"); process.exit(1); });
