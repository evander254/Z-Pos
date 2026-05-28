import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://cktnqgjkdxtwhibsblno.supabase.co";
const supabaseKey = "sb_publishable_dmDabIpAGiYC3GvXuim4RA_BJoeJIwp";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching sales logs from database...");

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('*, profiles:cashier_id(*)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (salesError) {
    console.error("Error fetching sales:", salesError.message);
    process.exit(1);
  }

  console.log(`Fetched ${sales.length} sales. Details:`);
  sales.forEach((s, i) => {
    console.log(`\n[Sale #${i + 1}]`);
    console.log(`ID: ${s.id}`);
    console.log(`Created At: ${s.created_at}`);
    console.log(`Total: ${s.total_amount}`);
    console.log(`Payment Method: "${s.payment_method}"`);
    console.log(`Cashier ID: ${s.cashier_id}`);
    console.log(`Profile:`, s.profiles);
  });

  console.log("\nFetching employees table contents...");
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('*, profiles(*)');

  if (empError) {
    console.error("Error fetching employees:", empError.message);
  } else {
    console.log(`Fetched ${employees.length} employees:`);
    employees.forEach(emp => {
      console.log(`- ID: ${emp.id}, User ID: ${emp.user_id}, Username: ${emp.username}, Full Name: ${emp.profiles?.full_name}, Email: ${emp.email}`);
    });
  }
}

run();
