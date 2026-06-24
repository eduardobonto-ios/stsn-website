# STSN Website — Online Enrollment Integration Guide

Repository: `stsn-website`  
Target route: `src/routes/enroll.tsx`  
Integration target: STSN Connect / ERP Supabase project

---

## Goal

Connect the public `Online Enrollment` page from `stsn-website` to the ERP database used by `stsn-connect`.

When a parent/student submits the website enrollment form:

1. The website must submit the enrollment application into the ERP Supabase project.
2. Continuing students must enter an LRN first.
3. The website must look up that LRN from the ERP database and auto-fill known student details.
4. New and continuing submissions must appear in the ERP Registrar workflow as `Pending` online enrollment records.
5. The website enrollment UI must collect the required ERP student/enrollment fields as much as possible before submission.
6. The ERP must still compute and store `missing_fields` as backend validation and Registrar tracking only.

---

## Important architecture decision

The website should adjust to the ERP data requirements, not the other way around.

This means:

- The actual missing student/enrollment details should be added as fields in the `stsn-website` online enrollment UI.
- The ERP `missing_fields` column should not be treated as a user input field.
- The ERP `missing_fields` value should be automatically computed by the ERP submit RPC or validation logic.
- The website should validate required fields before submission.
- The ERP should still revalidate the submitted payload as a backend safety check.

Correct responsibility split:

| Area | Responsibility |
| --- | --- |
| `stsn-website` | Collect complete online enrollment details from parent/student |
| `stsn-connect` / ERP | Validate, store, tag as Online, show as Pending, track missing fields for Registrar |
| Supabase RPC | Safely receive website payload and prevent direct public writes to sensitive ERP tables |

---

## Current website finding

The website currently has only a UI-only submit flow in:

```text
src/routes/enroll.tsx
```

Current behavior:

- Uses local React state only.
- Uses a fake `setTimeout` submit.
- Shows a success toast.
- Does not call Supabase.
- Does not perform LRN lookup.
- Does not insert or submit data into the ERP.

Required behavior:

- Replace the fake submit with a Supabase RPC call.
- Add LRN lookup for Continuing Student.
- Convert enrollment form fields into controlled state or a form library such as `react-hook-form`.
- Expand the form to collect the ERP-required student/enrollment details.
- Submit only through safe ERP RPC functions.

---

## ERP database/table alignment

The ERP repo uses Supabase and currently works with these relevant table names:

- `public.students`
- `public.enrollments`
- `public.requirements`
- `public.assessments`
- `public.student_guardians`

Do not create or use a new singular `public.student` table unless the ERP schema has been intentionally changed.

Use the existing ERP table naming:

```text
public.students
```

not:

```text
public.student
```

---

## Security rule

Do not hardcode Supabase credentials directly inside React components.

Use environment variables only:

```env
VITE_SUPABASE_URL=<ERP_SUPABASE_PROJECT_URL>
VITE_SUPABASE_ANON_KEY=<ERP_SUPABASE_ANON_KEY>
```

The Supabase URL and anon key may be copied from the provided project credential screenshot, but they must be placed in:

```text
.env.local
```

or the hosting platform environment settings.

Do not commit `.env.local`.

Never expose the Supabase service-role key in the browser.

---

## Required Supabase access pattern

For production, the public website must not directly select from `students` or directly insert into all ERP tables.

The website should call only safe Supabase RPC functions created by the ERP migration:

```text
lookup_online_student_by_lrn(p_lrn text)
submit_online_enrollment(p_payload jsonb)
```

Purpose:

| RPC | Purpose |
| --- | --- |
| `lookup_online_student_by_lrn` | Public-safe LRN lookup for Continuing Students |
| `submit_online_enrollment` | Public-safe submit endpoint for website enrollment |

The RPCs should be created in the `stsn-connect` repository migration, not in `stsn-website`.

---

## Required package

Install Supabase client in `stsn-website`:

```bash
npm install @supabase/supabase-js
```

---

## Files to add/update in `stsn-website`

### 1. Add `src/lib/supabase.ts`

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

### 2. Add `src/lib/online-enrollment.ts`

```ts
import { supabase } from "./supabase";

export type WebsiteEnrollmentType = "New Student" | "Continuing Student";

export interface OnlineEnrollmentPayload {
  enrollmentType: WebsiteEnrollmentType;

  // Student identity
  lrn?: string;
  studentNo?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  birthDate?: string;
  gender?: string;

  // Contact details
  email?: string;
  contactNo?: string;

  // Address details
  completeAddress?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  zipCode?: string;

  // Academic/enrollment details
  gradeLevelApplyingFor: string;
  schoolYear: string;
  strandOrTrack?: string;
  previousSchool?: string;
  previousSchoolAddress?: string;

  // Guardian/parent details
  guardianName?: string;
  guardianRelationship?: string;
  guardianContactNo?: string;
  guardianEmail?: string;
  guardianAddress?: string;

  submittedFrom: "stsn-website";
}

export interface LrnLookupResult {
  studentId: string;
  lrn: string | null;
  studentNo: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  yearLevel: string | null;
  trackOrCourse: string | null;
  enrollmentStatus: string;
}

export async function lookupStudentByLrn(lrn: string): Promise<LrnLookupResult | null> {
  const normalizedLrn = lrn.trim();

  if (!normalizedLrn) {
    return null;
  }

  const { data, error } = await supabase.rpc("lookup_online_student_by_lrn", {
    p_lrn: normalizedLrn,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function submitOnlineEnrollment(payload: OnlineEnrollmentPayload) {
  const { data, error } = await supabase.rpc("submit_online_enrollment", {
    p_payload: payload,
  });

  if (error) {
    throw error;
  }

  return data;
}
```

---

### 3. Update `src/routes/enroll.tsx`

Required changes:

1. Keep the existing website UI style as much as possible.
2. Convert all enrollment form fields into controlled state or `react-hook-form`.
3. Replace fake `setTimeout` submit with `submitOnlineEnrollment(payload)`.
4. Add LRN lookup behavior for Continuing Student.
5. Add the missing ERP-required fields to the website enrollment UI.
6. Prevent duplicate submission while `busy === true`.
7. Show the ERP-generated reference/tracking number after successful submission.
8. Show user-friendly errors on failure and preserve form values.

---

## Required website enrollment UI field expansion

The website enrollment UI must be expanded to include the required ERP student/enrollment fields.

The parent/student should complete these fields directly on the website before submission.

The ERP `missing_fields` column should only be used for backend validation and Registrar tracking.

It should not be shown as a free-text input and should not be manually entered by the user.

---

## Minimum fields to include in the website enrollment form

### A. Student status

Required:

- New Student
- Continuing Student

Behavior:

- If `Continuing Student` is selected, LRN is required.
- If `New Student` is selected, LRN may be optional depending on school policy.

---

### B. Student identity information

Recommended fields:

| Field | Required for New Student | Required for Continuing Student | Notes |
| --- | --- | --- | --- |
| LRN | Optional or policy-based | Yes | Used for ERP lookup |
| First Name | Yes | Auto-filled, still editable if allowed | From ERP lookup if continuing |
| Middle Name | Optional | Auto-filled if available | From ERP lookup if continuing |
| Last Name | Yes | Auto-filled, still editable if allowed | From ERP lookup if continuing |
| Birthdate | Yes | Required if missing from ERP | Add to website UI |
| Gender | Yes | Required if missing from ERP | Add to website UI |

---

### C. Student contact information

Recommended fields:

| Field | Required | Notes |
| --- | --- | --- |
| Contact Number | Yes | Student or parent contact number |
| Email Address | Recommended | Useful for enrollment reference and updates |

---

### D. Student address information

Recommended fields:

| Field | Required | Notes |
| --- | --- | --- |
| Complete Address | Yes | House no., street, subdivision |
| Barangay | Yes | Required for local address |
| City/Municipality | Yes | Required |
| Province | Yes | Required |
| ZIP Code | Optional | Recommended |

---

### E. Academic/enrollment information

Recommended fields:

| Field | Required | Notes |
| --- | --- | --- |
| School Year | Yes | Example: `2026-2027` |
| Grade/Level Applying For | Yes | Required for assessment/enrollment |
| Strand/Track | Conditional | Required for SHS or if applicable |
| Previous School | Required for New/Transferee if applicable | Useful for Registrar review |
| Previous School Address | Required for New/Transferee if applicable | Useful for Registrar review |

---

### F. Guardian/parent information

Recommended fields:

| Field | Required | Notes |
| --- | --- | --- |
| Guardian Name | Yes | Parent/guardian full name |
| Guardian Relationship | Yes | Father, Mother, Guardian, etc. |
| Guardian Contact Number | Yes | Required for communication |
| Guardian Email | Optional | Recommended |
| Guardian Address | Optional | Required if different from student address |

---

## Client-side validation behavior

Add client-side validation before calling `submit_online_enrollment`.

Suggested validation helper:

```ts
import type { OnlineEnrollmentPayload } from "@/lib/online-enrollment";

export function getMissingFields(payload: OnlineEnrollmentPayload): string[] {
  const missing: string[] = [];

  if (payload.enrollmentType === "Continuing Student" && !payload.lrn?.trim()) {
    missing.push("LRN");
  }

  if (!payload.firstName?.trim()) missing.push("First Name");
  if (!payload.lastName?.trim()) missing.push("Last Name");
  if (!payload.birthDate?.trim()) missing.push("Birthdate");
  if (!payload.gender?.trim()) missing.push("Gender");
  if (!payload.contactNo?.trim()) missing.push("Contact Number");
  if (!payload.completeAddress?.trim()) missing.push("Complete Address");
  if (!payload.barangay?.trim()) missing.push("Barangay");
  if (!payload.cityMunicipality?.trim()) missing.push("City/Municipality");
  if (!payload.province?.trim()) missing.push("Province");
  if (!payload.gradeLevelApplyingFor?.trim()) missing.push("Grade/Level Applying For");
  if (!payload.schoolYear?.trim()) missing.push("School Year");
  if (!payload.guardianName?.trim()) missing.push("Guardian Name");
  if (!payload.guardianRelationship?.trim()) missing.push("Guardian Relationship");
  if (!payload.guardianContactNo?.trim()) missing.push("Guardian Contact Number");

  return missing;
}
```

Recommended submit behavior:

```ts
const missingFields = getMissingFields(payload);

if (missingFields.length > 0) {
  toast.error(`Please complete the required fields: ${missingFields.join(", ")}`);
  return;
}

await submitOnlineEnrollment(payload);
```

The ERP should still recompute `missing_fields` after submission as backend validation.

---

## Continuing Student LRN lookup behavior

When the user selects `Continuing Student`:

1. LRN field must be visible and required.
2. The form should show a `Check LRN` button or trigger lookup after a valid LRN length.
3. The website should call:

```ts
lookupStudentByLrn(lrn)
```

4. If the LRN is found, auto-fill available student details:

- First Name
- Last Name
- Middle Name
- Current Grade/Year Level
- Strand/Track or Course, if returned

5. If the LRN is not found:

- Show a clear error.
- Do not submit.
- Do not auto-fill fake data.

6. The user must still complete missing or updated details such as:

- Contact number
- Email
- Address
- Guardian information
- Grade/Level Applying For
- School Year

7. Do not overwrite existing ERP student values with blank website fields.

---

## New Student behavior

When the user selects `New Student`:

1. LRN may be optional depending on school policy.
2. Show the full enrollment form.
3. Require minimum student identity, address, academic, and guardian fields.
4. Submit the payload to:

```ts
submitOnlineEnrollment(payload)
```

5. On success, display the reference number returned by the ERP RPC.

---

## Expected website flow

### New Student

1. User selects `New Student`.
2. User fills out required student, address, academic, contact, and guardian information.
3. Website validates required fields.
4. Website calls `submit_online_enrollment`.
5. ERP creates a pending online application.
6. ERP creates or links a student record.
7. ERP creates a pending enrollment.
8. Website displays the generated online application reference number.

---

### Continuing Student

1. User selects `Continuing Student`.
2. LRN becomes required.
3. User enters LRN.
4. Website calls `lookup_online_student_by_lrn`.
5. ERP returns limited student information only.
6. Website auto-fills known fields.
7. User completes missing or updated fields.
8. Website validates required fields.
9. Website calls `submit_online_enrollment`.
10. ERP creates a pending online enrollment linked to the existing student.
11. Website displays the generated online application reference number.

---

## Data mapping from website form to ERP payload

| Website field | Payload field | ERP target |
| --- | --- | --- |
| Student Status | `enrollmentType` | `enrollments.enrollment_type`, mapped to ERP values |
| LRN | `lrn` | `students.lrn` lookup / link |
| Student No. | `studentNo` | Optional reference only |
| First Name | `firstName` | `students.first_name` |
| Last Name | `lastName` | `students.last_name` |
| Middle Name | `middleName` | `students.middle_name` |
| Birthdate | `birthDate` | `students.birth_date` if available / payload JSON |
| Gender | `gender` | `students.gender` |
| Contact No. | `contactNo` | `students.contact_no` if provided |
| Email | `email` | `students.email` if provided |
| Complete Address | `completeAddress` | student address field if available / payload JSON |
| Barangay | `barangay` | student address field if available / payload JSON |
| City/Municipality | `cityMunicipality` | student address field if available / payload JSON |
| Province | `province` | student address field if available / payload JSON |
| ZIP Code | `zipCode` | student address field if available / payload JSON |
| Grade/Level Applying For | `gradeLevelApplyingFor` | `students.year_level` and `online_enrollment_applications.grade_level_applying_for` |
| School Year | `schoolYear` | `enrollments.school_year` |
| Strand/Track | `strandOrTrack` | `students.track_or_course` if applicable |
| Previous School | `previousSchool` | `online_enrollment_applications.previous_school` / payload JSON |
| Previous School Address | `previousSchoolAddress` | `online_enrollment_applications.previous_school_address` / payload JSON |
| Guardian Name | `guardianName` | `student_guardians.guardian_name` if provided |
| Guardian Relationship | `guardianRelationship` | `student_guardians.relationship` if available / payload JSON |
| Guardian Contact | `guardianContactNo` | `student_guardians.contact_no` if provided |
| Guardian Email | `guardianEmail` | guardian email field if available / payload JSON |
| Guardian Address | `guardianAddress` | guardian address field if available / payload JSON |
| Submitted From | `submittedFrom` | `online_enrollment_applications.submitted_from` |

---

## Website form UX requirements

Keep the current page style, but organize the form into clear sections:

1. Student Status
2. Student Information
3. Contact Information
4. Address Information
5. Academic Details
6. Parent/Guardian Information
7. Submission confirmation

Recommended UX behavior:

- Disable submit button while submitting.
- Show loading state during LRN lookup.
- Show a success state after submission.
- Show reference number after successful submission.
- Show clear errors for invalid LRN or failed submit.
- Preserve form values when an error occurs.
- Avoid duplicate submissions.
- Make required fields visually clear.
- Do not expose internal database field names to parents/students.

---

## Do not do these

- Do not create or modify Supabase migrations in this repository.
- Do not insert directly into `public.student`.
- Do not insert directly into sensitive ERP tables from the public website.
- Do not hardcode Supabase URL/key inside `enroll.tsx`.
- Do not expose service-role keys in the browser.
- Do not allow the public website to read the full `students` table.
- Do not overwrite existing ERP student data with blank website fields.
- Do not bypass the ERP enrollment workflow.
- Do not auto-approve online enrollment records.
- Do not modify unrelated website pages.

---

## Credit-efficient Claude prompt for `stsn-website`

Use this prompt in the `stsn-website` repository only:

```text
Task: Connect the Online Enrollment page to the ERP Supabase project and expand the website enrollment UI to collect the ERP-required enrollment fields. Only modify the website enrollment integration. Do not redesign unrelated pages.

Read this file first:
- STSN_WEBSITE_ONLINE_ENROLLMENT_INTEGRATION.md

Current target file:
- src/routes/enroll.tsx

Add only the necessary support files:
- src/lib/supabase.ts
- src/lib/online-enrollment.ts

Requirements:
1. Install/use @supabase/supabase-js if not already available.
2. Read Supabase values only from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Do not hardcode credentials.
3. Keep the existing UI style of the enroll page.
4. Replace the fake setTimeout submit with the RPC submit_online_enrollment(p_payload jsonb).
5. Add LRN lookup for Continuing Student using lookup_online_student_by_lrn(p_lrn text).
6. Continuing Student must require LRN before submit.
7. If LRN lookup succeeds, auto-fill first name, last name, middle name, and current academic fields returned by the RPC.
8. If LRN lookup fails, show a toast/error and do not auto-fill.
9. Expand the online enrollment form UI to collect ERP-required fields:
   - birthdate
   - gender
   - contact number
   - email
   - complete address
   - barangay
   - city/municipality
   - province
   - ZIP code
   - school year
   - grade/level applying for
   - strand/track if applicable
   - previous school
   - previous school address
   - guardian name
   - guardian relationship
   - guardian contact number
   - guardian email if available
   - guardian address if different from student address
10. The actual missing information should be collected from the applicant/parent in the website UI before submission.
11. The ERP missing_fields value is backend validation/tracking only. Do not create a free-text missing_fields input in the website UI.
12. For Continuing Student, LRN lookup should auto-fill existing values, but the user must still complete missing or outdated enrollment/contact/guardian information before submission.
13. Submit New Student and Continuing Student to submit_online_enrollment using the payload mapping in this MD file.
14. Prevent double submit while busy.
15. On success, show the reference/tracking number returned by the RPC.
16. On error, keep the form values and show a friendly error toast.
17. Do not create or modify Supabase migrations in this repository. The ERP migration belongs to stsn-connect.
18. Browser network tab should show RPC calls only, not direct full-table students select.
19. Run npm run build or npm run lint after changes and fix only issues caused by this task.
```

---

## Manual verification checklist

Environment:

- `.env.local` contains the ERP Supabase URL and anon key.
- Supabase service-role key is not present in the website repo.
- `@supabase/supabase-js` is installed.

Build:

- `npm run build` succeeds.
- `npm run lint` succeeds if lint script exists.

LRN lookup:

- Selecting `Continuing Student` requires LRN.
- Valid LRN calls `lookup_online_student_by_lrn`.
- Valid LRN auto-fills available student fields.
- Invalid LRN shows an error and does not submit.
- Browser network tab does not show direct full-table `students` select.

New Student submit:

- Required student, contact, address, academic, and guardian fields are validated.
- Submit calls `submit_online_enrollment`.
- Success displays online application reference number.
- Record appears in ERP Registrar queue as Online + Pending.

Continuing Student submit:

- Existing student is linked by LRN.
- Required missing/current enrollment fields are completed.
- Submit calls `submit_online_enrollment`.
- Success displays online application reference number.
- ERP creates a new Pending Online enrollment linked to the existing student.

Duplicate prevention:

- Double-clicking Submit does not create duplicate submissions.
- Submit button is disabled while busy.

Error handling:

- Failed submit preserves form values.
- Failed submit shows friendly error message.
- No raw database or Supabase internal error details are shown to the user.
