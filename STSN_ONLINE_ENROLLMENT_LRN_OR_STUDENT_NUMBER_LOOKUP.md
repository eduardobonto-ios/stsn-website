# STSN Online Enrollment — LRN or Student Number Lookup Update

Scope: Continuing Student lookup only  
Repositories affected:

- `stsn-website`
- `stsn-connect`

---

## Goal

Update the Continuing Student online enrollment lookup so the user can search using either:

- LRN / Learner Reference Number
- Student Number

This replaces the current LRN-only lookup behavior.

---

## Current UI

Current field label:

```text
Learner Reference No. (LRN) *
```

Current button label:

```text
Check LRN
```

---

## Required UI change in `stsn-website`

Update the Continuing Student lookup field label to:

```text
LRN or Student Number *
```

Recommended placeholder:

```text
Enter LRN or Student Number
```

Update the lookup button label from:

```text
Check LRN
```

to:

```text
Check Student
```

---

## Expected website behavior

When `Continuing Student` is selected:

1. Show the `LRN or Student Number` input field.
2. Require the user to enter either an LRN or Student Number.
3. When the user clicks `Check Student`, call the ERP lookup RPC.
4. If a matching student is found, auto-fill available student details.
5. If no student is found, show a clear error message.
6. Do not submit the enrollment unless a valid continuing student is found.
7. Do not perform a direct public `students` table query from the website.

---

## Required ERP RPC change in `stsn-connect`

Add a new safe RPC:

```sql
lookup_online_student_by_identifier(p_identifier text)
```

This RPC should search both:

```text
public.students.lrn
public.students.student_no
```

The RPC should return only the minimal fields needed by the website form.

Required return fields:

```text
student_id
lrn
student_no
first_name
last_name
middle_name
year_level
track_or_course
enrollment_status
```

Do not expose the full student record.

---

## Suggested RPC implementation

Add this in the ERP Supabase migration for online enrollment bridge.

```sql
create or replace function public.lookup_online_student_by_identifier(p_identifier text)
returns table (
  student_id uuid,
  lrn text,
  student_no text,
  first_name text,
  last_name text,
  middle_name text,
  year_level text,
  track_or_course text,
  enrollment_status text
)
language sql
security definer
set search_path = public
as $$
  select
    s.id as student_id,
    s.lrn,
    s.student_no,
    s.first_name,
    s.last_name,
    s.middle_name,
    s.year_level,
    s.track_or_course,
    s.enrollment_status
  from public.students s
  where (
      s.lrn = btrim(p_identifier)
      or lower(s.student_no) = lower(btrim(p_identifier))
    )
    and coalesce(s.enrollment_status, '') <> 'Rejected'
  limit 1;
$$;

grant execute on function public.lookup_online_student_by_identifier(text) to anon, authenticated;
```

---

## Required website service update

In `stsn-website`, update the online enrollment service function.

Replace LRN-only lookup naming:

```ts
lookupStudentByLrn(lrn)
```

with identifier-based lookup:

```ts
lookupStudentByIdentifier(identifier)
```

Suggested implementation:

```ts
export async function lookupStudentByIdentifier(identifier: string): Promise<LrnLookupResult | null> {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier) {
    return null;
  }

  const { data, error } = await supabase.rpc("lookup_online_student_by_identifier", {
    p_identifier: normalizedIdentifier,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}
```

---

## Required website form validation

For Continuing Student, the field should be required.

Validation message:

```text
Please enter your LRN or Student Number.
```

If no matching student is found:

```text
No student record found for the provided LRN or Student Number.
```

If lookup succeeds:

```text
Student record found. Please review and complete the remaining enrollment details.
```

---

## Important rules

- Do not expose the full `students` table to the public website.
- Do not use direct `select` from `public.students` in the website.
- Do not expose Supabase service-role keys.
- Do not overwrite ERP student data with blank website values.
- Do not auto-approve online enrollment after lookup.
- Continuing Student enrollment should still create a Pending online enrollment for Registrar review.

---

## Credit-efficient Claude prompt

Use this prompt only for the LRN or Student Number lookup update.

```text
Task: Update the Continuing Student online enrollment lookup to accept either LRN or Student Number. Only modify the lookup behavior and required labels. Do not redesign unrelated pages and do not change unrelated enrollment logic.

Repositories:
- stsn-website
- stsn-connect

Requirements for stsn-connect:
1. Add a safe Supabase RPC named lookup_online_student_by_identifier(p_identifier text).
2. The RPC must search public.students by either lrn or student_no.
3. The RPC must return only minimal fields needed by the website:
   - student_id
   - lrn
   - student_no
   - first_name
   - last_name
   - middle_name
   - year_level
   - track_or_course
   - enrollment_status
4. Grant execute to anon and authenticated.
5. Do not expose the full students table.

Requirements for stsn-website:
1. Change the Continuing Student field label from "Learner Reference No. (LRN)" to "LRN or Student Number".
2. Change the button label from "Check LRN" to "Check Student".
3. Replace the LRN-only lookup call with lookup_online_student_by_identifier.
4. Rename the website service function from lookupStudentByLrn to lookupStudentByIdentifier if applicable.
5. Require the field before lookup and submit.
6. If no record is found, show a clear user-friendly error.
7. If a record is found, auto-fill the returned student fields and allow the user to complete the remaining enrollment details.
8. Do not query the students table directly from the website.
9. Do not hardcode Supabase credentials.
10. Do not auto-approve the enrollment.

Validation:
- npm run build or npm run lint must pass.
- Continuing Student lookup works using LRN.
- Continuing Student lookup works using Student Number.
- Invalid identifier shows an error.
- The website network tab should show RPC call only, not direct students table select.
```

---

## Manual verification checklist

Website:

- Field label shows `LRN or Student Number`.
- Button shows `Check Student`.
- Empty field shows validation error.
- Valid LRN finds the student.
- Valid Student Number finds the student.
- Invalid value shows a clear error.
- Found student details are auto-filled.
- Submit remains Pending for Registrar review.

ERP:

- `lookup_online_student_by_identifier` exists.
- RPC searches both `students.lrn` and `students.student_no`.
- RPC returns only minimal fields.
- RPC can be executed by anon/authenticated.
- Full `students` table is not exposed to the public website.
