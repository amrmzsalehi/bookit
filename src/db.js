import { createClient } from '@supabase/supabase-js'
// ─────────────────────────────────────────
// PROFILES
// ─────────────────────────────────────────

// Save or update a user's profile
export async function saveProfile(firebaseUID, data) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: firebaseUID,         // links Firebase user to Supabase row
      role: data.role,
      name: data.name,
      location: data.location,
      housing_pref: data.housing_pref
    }); // Added semicolon here to close the await statement

  if (error) {
    console.error("Error in saveProfile:", error.message);
    throw error;
  }
}

// Get a user's profile by their Firebase UID
export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()   // ✅ IMPORTANT (not .single)

  if (error) {
    console.error("Profile fetch error:", error)
    return null
  }

  return data
}
// ─────────────────────────────────────────
// LISTINGS
// ─────────────────────────────────────────

// Get suggestions for homepage
// Matches user's on/off campus pref, sorted by distance
export async function getSuggestions(userProfile) {
  let query = supabase
    .from('listings')
    .select('*, profiles(name)')  // also fetches landlord's name
    .order('distance_km', { ascending: true })
    .limit(12)

  // Only filter by type if user has a specific preference
  if (userProfile.housing_pref !== 'both') {
    query = query.eq('type', userProfile.housing_pref)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

// Search listings with filters (all filters are optional)
export async function searchListings({ maxPrice, roomType, type, amenity } = {}) {
  let query = supabase
    .from('listings')
    .select('*, profiles(name)')
    .order('created_at', { ascending: false })

  if (maxPrice) query = query.lte('price', maxPrice)
  if (roomType) query = query.eq('room_type', roomType)
  if (type) query = query.eq('type', type)
  if (amenity) query = query.contains('amenities', [amenity])

  const { data, error } = await query
  if (error) throw error
  return data
}

// Landlord: create a new listing
export async function createListing(landlordUID, formData) {
  const { data, error } = await supabase
    .from('listings')
    .insert({
      landlord_id: landlordUID,
      title: formData.title,
      description: formData.description,
      location: formData.location,
      type: formData.type,
      room_type: formData.room_type,
      price: Number(formData.price),
      spots: Number(formData.spots),
      amenities: formData.amenities || [],
      distance_km: Number(formData.distance_km)
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Landlord: get their own listings
export async function getMyListings(landlordUID) {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('landlord_id', landlordUID)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ─────────────────────────────────────────
// APPLICATIONS
// ─────────────────────────────────────────

// Student: apply to a listing
export async function applyToListing(studentUID, listingId, { priority = 3, message = '' } = {}) {
  // Check if already applied
  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('student_id', studentUID)
    .eq('listing_id', listingId)
    .single()

  if (existing) throw new Error('You already applied to this listing')

  const { error } = await supabase
    .from('applications')
    .insert({
      student_id: studentUID,
      listing_id: listingId,
      priority,
      message,
      status: 'pending'
    })
  if (error) throw error
}

// Student: get their top 5 priority applications
export async function getMyApplications(studentUID) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      *,
      listings (title, location, price, type, room_type)
    `)
    .eq('student_id', studentUID)
    .order('priority', { ascending: true })   // 1 = highest priority shown first
    .limit(5)
  if (error) throw error
  return data
}

// Landlord: get all applications for their listings
export async function getApplicationsForLandlord(landlordUID) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      *,
      listings!inner (title, landlord_id),
      profiles (name)
    `)
    .eq('listings.landlord_id', landlordUID)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Landlord: accept or reject an application
export async function updateApplicationStatus(applicationId, status) {
  // status must be 'accepted' or 'rejected'
  const { error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
  if (error) throw error
}

// ─────────────────────────────────────────
// MESSAGES (Chat)
// ─────────────────────────────────────────

// Send a message
export async function sendMessage(listingId, senderId, receiverId, content) {
  const { error } = await supabase
    .from('messages')
    .insert({ listing_id: listingId, sender_id: senderId, receiver_id: receiverId, content })
  if (error) throw error
}

// Get all messages in a chat thread (by listing + two users)
export async function getChatMessages(listingId, userA, userB) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, profiles(name)')
    .eq('listing_id', listingId)
    .or(
      `and(sender_id.eq.${userA},receiver_id.eq.${userB}),` +
      `and(sender_id.eq.${userB},receiver_id.eq.${userA})`
    )
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// Subscribe to new messages in real-time
// Returns an "unsubscribe" function — call it when the chat component unmounts
export function subscribeToChat(listingId, onNewMessage) {
  const channel = supabase
    .channel('chat-' + listingId)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `listing_id=eq.${listingId}` },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe()

  // Return cleanup function
  return () => supabase.removeChannel(channel)
}

// Subscribe to application status changes (for student dashboard)
export function subscribeToApplications(studentUID, onUpdate) {
  const channel = supabase
    .channel('apps-' + studentUID)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'applications', filter: `student_id=eq.${studentUID}` },
      (payload) => onUpdate(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
