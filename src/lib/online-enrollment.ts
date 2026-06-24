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

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0];
  return {
    studentId: row.student_id,
    lrn: row.lrn,
    studentNo: row.student_no,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name,
    yearLevel: row.year_level,
    trackOrCourse: row.track_or_course,
    enrollmentStatus: row.enrollment_status,
  };
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

export function getMissingFields(payload: OnlineEnrollmentPayload): string[] {
  const missing: string[] = [];

  if (payload.enrollmentType === "Continuing Student" && !payload.lrn?.trim()) {
    missing.push("LRN or Student Number");
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
