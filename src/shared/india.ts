export const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const educationStages = [
  "Class 10", "Class 11", "Class 12", "Undergraduate", "Graduate", "Postgraduate", "Working professional", "Other",
] as const;

export const languages = [
  "English", "Hindi", "Tamil", "Telugu", "Malayalam", "Kannada", "Marathi", "Bengali", "Gujarati",
  "Odia", "Punjabi", "Urdu", "Assamese",
] as const;

export const languageCodes: Record<string, string> = {
  English: "en", Hindi: "hi", Tamil: "ta", Telugu: "te", Malayalam: "ml", Kannada: "kn", Marathi: "mr",
  Bengali: "bn", Gujarati: "gu", Odia: "or", Punjabi: "pa", Urdu: "ur", Assamese: "as",
};
