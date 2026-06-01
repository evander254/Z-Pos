import { createServerFn } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import * as fs from "fs";
import * as path from "path";

function isSimulatedMode() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return !key || key.includes("placeholder") || key.includes("mock");
}

function getMockDbPath() {
  return path.join(process.cwd(), "src", "lib", "mock-employees.json");
}

function readMockEmployees(): any[] {
  const filePath = getMockDbPath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to read mock employees JSON:", e);
    return [];
  }
}

function writeMockEmployees(employees: any[]) {
  const filePath = getMockDbPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(employees, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write mock employees JSON:", e);
  }
}

// Helper to send credential notification email via Resend API
async function sendEmployeeCredentialsEmail({
  email,
  fullName,
  businessName,
  workAccountNumber,
  password,
  slug
}: {
  email: string;
  fullName: string;
  businessName: string;
  workAccountNumber: string;
  password: string;
  slug: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const loginUrl = `${process.env.VITE_APP_URL || 'http://localhost:8080'}/auth/login`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #7c3aed; margin-bottom: 20px;">Welcome to ZPos!</h2>
      <p>Hello <strong>${fullName}</strong>,</p>
      <p>You have been registered as an employee for <strong>${businessName}</strong> on ZPos.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">Your Login Credentials:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 160px;">Work Account ID:</td>
            <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: bold; font-family: monospace;">${workAccountNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Temporary Password:</td>
            <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: bold; font-family: monospace;">${password}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Workspace Slug:</td>
            <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-family: monospace;">${slug}</td>
          </tr>
        </table>
      </div>

      <p style="margin-top: 25px;">
        <a href="${loginUrl}" style="background-color: #7c3aed; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
          Log In to POS
        </a>
      </p>

      <p style="color: #64748b; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        Use your Work Account ID and Password on the login page. Once logged in, you can set up simulated fingerprint biometrics for quicker sign-in.
      </p>
    </div>
  `;

  if (!apiKey) {
    console.log("=== [SIMULATED EMAIL] ===");
    console.log(`To: ${email}`);
    console.log(`Subject: Welcome to ZPos - Your Login Details`);
    console.log(`Body:\n`, htmlContent.replace(/<[^>]*>/g, '').trim());
    console.log("==========================");
    return { success: true, simulated: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "ZPos <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to ZPos - Your Login Details",
        html: htmlContent
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend Email API failed:", errText);
      return { success: false, error: errText };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to send email via Resend:", error);
    return { success: false, error: error.message };
  }
}

// Server action to create a new employee and their associated auth user.
// Safe to run as it requires Owner/Admin permissions (verified in handler).
export const createEmployeeFn = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: any) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context; // Owner/Admin making the request
    const {
      username,
      full_name,
      email,
      phone,
      id_number,
      id_document_url,
      account_number,
      work_account_number,
      password,
      business_id,
      role,
      profile_picture_url,
      store_id
    } = data;

    // Security check: Verify that the authenticated user owns this business
    // Use user-scoped supabase client if simulated mode to allow RLS select by owner
    const client = isSimulatedMode() ? context.supabase : supabaseAdmin;
    const { data: business, error: bizError } = await client
      .from("businesses")
      .select("id, business_name, slug")
      .eq("id", business_id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (bizError || !business) {
      throw new Error("Unauthorized: You do not own this business.");
    }

    const cleanWorkAccountNumber = work_account_number.trim();
    const emailForLogin = `${cleanWorkAccountNumber}@zpos.internal`;

    if (isSimulatedMode()) {
      const newUserId = `mock-user-${Date.now()}`;
      const mockEmployee = {
        id: `mock-emp-${Date.now()}`,
        user_id: newUserId,
        business_id,
        business_slug: business.slug,
        role: role || "cashier",
        active: true,
        username,
        id_number,
        id_document_url,
        account_number,
        work_account_number: cleanWorkAccountNumber,
        password_plain: password,
        email,
        store_id,
        created_at: new Date().toISOString(),
        profiles: {
          full_name,
          phone,
          avatar_url: profile_picture_url
        }
      };

      const mockEmployees = readMockEmployees();
      mockEmployees.push(mockEmployee);
      writeMockEmployees(mockEmployees);

      let emailStatus = null;
      if (email && email.trim() !== "") {
        try {
          emailStatus = await sendEmployeeCredentialsEmail({
            email: email.trim(),
            fullName: full_name,
            businessName: business.business_name || "ZPos Business",
            workAccountNumber: cleanWorkAccountNumber,
            password,
            slug: business.slug
          });
        } catch (err: any) {
          console.error("Failed to send credentials email:", err);
          emailStatus = { success: false, error: err.message };
        }
      }

      return { success: true, employeeId: newUserId, simulated: true, emailStatus };
    }

    // 1. Create Supabase Auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailForLogin,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone,
        avatar_url: profile_picture_url,
        username
      }
    });

    if (authError || !authUser?.user) {
      throw new Error(authError?.message || "Failed to create authentication user.");
    }

    const newUserId = authUser.user.id;

    // 2. Ensure profile details are set correctly
    await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      full_name,
      phone,
      avatar_url: profile_picture_url
    });

    // 3. Insert employee record
    const { error: empError } = await supabaseAdmin.from("employees").insert({
      business_id,
      user_id: newUserId,
      role: role || "cashier",
      active: true,
      username,
      id_number,
      id_document_url,
      account_number,
      work_account_number: cleanWorkAccountNumber,
      password_plain: password,
      email,
      store_id
    });

    if (empError) {
      // Cleanup: delete the auth user if db record insertion fails
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(empError.message || "Failed to create employee database record.");
    }

    let emailStatus = null;
    if (email && email.trim() !== "") {
      try {
        emailStatus = await sendEmployeeCredentialsEmail({
          email: email.trim(),
          fullName: full_name,
          businessName: business.business_name || "ZPos Business",
          workAccountNumber: cleanWorkAccountNumber,
          password,
          slug: business.slug
        });
      } catch (err: any) {
        console.error("Failed to send credentials email:", err);
        emailStatus = { success: false, error: err.message };
      }
    }

    return { success: true, employeeId: newUserId, emailStatus };
  });

// Server action to update an existing employee and their associated auth user details
export const updateEmployeeFn = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: any) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const {
      employee_id, // employee.id (UUID)
      user_id, // profile user_id (UUID)
      username,
      full_name,
      email,
      phone,
      id_number,
      id_document_url,
      account_number,
      work_account_number,
      password, // optional new password
      role,
      active,
      profile_picture_url,
      business_id,
      store_id
    } = data;

    // Security check: Verify that the authenticated user owns this business
    const client = isSimulatedMode() ? context.supabase : supabaseAdmin;
    const { data: business, error: bizError } = await client
      .from("businesses")
      .select("id")
      .eq("id", business_id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (bizError || !business) {
      throw new Error("Unauthorized: You do not own this business.");
    }

    const cleanWorkAccountNumber = work_account_number.trim();

    if (isSimulatedMode()) {
      const mockEmployees = readMockEmployees();
      const index = mockEmployees.findIndex(e => e.id === employee_id || e.user_id === user_id);
      if (index !== -1) {
        mockEmployees[index] = {
          ...mockEmployees[index],
          role,
          active,
          username,
          id_number,
          id_document_url,
          account_number,
          work_account_number: cleanWorkAccountNumber,
          email,
          store_id,
          ...(password && password.trim() !== "" ? { password_plain: password } : {}),
          profiles: {
            ...mockEmployees[index].profiles,
            full_name,
            phone,
            avatar_url: profile_picture_url
          }
        };
        writeMockEmployees(mockEmployees);
      }
      return { success: true, simulated: true };
    }

    // 1. Update Auth details if password changes
    if (password && password.trim() !== "") {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: password
      });
      if (authError) {
        throw new Error(authError.message || "Failed to update auth password.");
      }
    }

    // Update metadata and email on auth
    await supabaseAdmin.auth.admin.updateUserById(user_id, {
      email: `${cleanWorkAccountNumber}@zpos.internal`, // keep email in sync if work account number changes
      user_metadata: {
        full_name,
        phone,
        avatar_url: profile_picture_url,
        username
      }
    });

    // 2. Update Profile
    await supabaseAdmin.from("profiles").upsert({
      id: user_id,
      full_name,
      phone,
      avatar_url: profile_picture_url
    });

    // 3. Update Employee details
    const updatePayload: any = {
      role,
      active,
      username,
      id_number,
      id_document_url,
      account_number,
      work_account_number: cleanWorkAccountNumber,
      email,
      store_id
    };

    if (password && password.trim() !== "") {
      updatePayload.password_plain = password;
    }

    const { error: empError } = await supabaseAdmin
      .from("employees")
      .update(updatePayload)
      .eq("id", employee_id);

    if (empError) {
      throw new Error(empError.message || "Failed to update employee database record.");
    }

    return { success: true };
  });

// Server action to delete an employee (which cascade deletes profile and employee record)
export const deleteEmployeeFn = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: any) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { employee_id, user_id, business_id } = data;

    // Security check: Verify that the authenticated user owns this business
    const client = isSimulatedMode() ? context.supabase : supabaseAdmin;
    const { data: business, error: bizError } = await client
      .from("businesses")
      .select("id")
      .eq("id", business_id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (bizError || !business) {
      throw new Error("Unauthorized: You do not own this business.");
    }

    if (isSimulatedMode()) {
      const mockEmployees = readMockEmployees();
      const updated = mockEmployees.filter(e => e.id !== employee_id && e.user_id !== user_id);
      writeMockEmployees(updated);
      return { success: true, simulated: true };
    }

    // Deleting the auth user automatically deletes the profile and employee record via cascade delete
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authError) {
      throw new Error(authError.message || "Failed to delete employee user.");
    }

    return { success: true };
  });

// Server action to get employee login details anonymously (unauthenticated) using POST
export const getEmployeeLoginDetailsFn = createServerFn({ method: "POST" })
  .inputValidator((data: any) => data)
  .handler(async ({ data }) => {
    const { workAccountNumber } = data;
    if (!workAccountNumber) {
      throw new Error("Work Account Number is required.");
    }

    if (isSimulatedMode()) {
      const mockEmployees = readMockEmployees();
      const employee = mockEmployees.find(e => e.work_account_number === workAccountNumber.trim());
      if (!employee) {
        throw new Error("No employee found with this Work Account Number.");
      }
      if (!employee.active) {
        throw new Error("This employee account is inactive.");
      }
      return {
        email: `${employee.work_account_number}@zpos.internal`,
        password: employee.password_plain,
        slug: employee.business_slug || "simulated-slug",
        simulated: true,
        employeeData: employee
      };
    }

    // Query employees table using admin client (bypasses RLS)
    const { data: employee, error } = await supabaseAdmin
      .from("employees")
      .select("id, work_account_number, business_id, active, password_plain")
      .eq("work_account_number", workAccountNumber.trim())
      .maybeSingle();

    if (error || !employee) {
      throw new Error("No employee found with this Work Account Number.");
    }

    if (!employee.active) {
      throw new Error("This employee account is inactive.");
    }

    if (!employee.business_id) {
      throw new Error("Employee is not linked to any business.");
    }

    // Get business slug
    const { data: business, error: bizError } = await supabaseAdmin
      .from("businesses")
      .select("slug")
      .eq("id", employee.business_id)
      .single();

    if (bizError || !business) {
      throw new Error("Business not found for this employee.");
    }

    return {
      email: `${employee.work_account_number}@zpos.internal`,
      password: employee.password_plain,
      slug: business.slug
    };
  });

// Server action to list simulated employees (unauthenticated/authenticated lookup)
export const listMockEmployeesFn = createServerFn({ method: "POST" })
  .inputValidator((data: any) => data)
  .handler(async ({ data }) => {
    const { business_id } = data;
    if (isSimulatedMode()) {
      const mockEmployees = readMockEmployees();
      const filtered = mockEmployees.filter(e => e.business_id === business_id);
      return { employees: filtered };
    }
    return { employees: [] };
  });
