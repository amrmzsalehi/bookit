import { useState, useEffect, useRef } from 'react'
import { auth, signInWithGoogle, logout } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  saveProfile, getMyProfile,
  getSuggestions, searchListings, createListing, getMyListings,
  applyToListing, getMyApplications, getApplicationsForLandlord, updateApplicationStatus,
  sendMessage, getChatMessages, subscribeToChat, subscribeToApplications
} from './db'

const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap'
document.head.appendChild(fontLink)

const globalStyle = document.createElement('style')
globalStyle.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #F7F5F0; color: #1a1a18; min-height: 100vh; }
  input, textarea, select, button { font-family: 'DM Sans', sans-serif; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin   { to { transform: rotate(360deg); } }
  .fadeUp  { animation: fadeUp 0.4s ease both; }
  .delay1  { animation-delay: 0.06s; }
  .delay2  { animation-delay: 0.12s; }
  .delay3  { animation-delay: 0.18s; }
  .delay4  { animation-delay: 0.24s; }
  .hoverable { transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: pointer; }
  .hoverable:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0,0,0,0.09); }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-thumb { background: #d4cfc6; border-radius: 99px; }
`
document.head.appendChild(globalStyle)

const C = {
  bg: '#F7F5F0', surface: '#FFFFFF', border: '#E8E4DC',
  ink: '#1a1a18', inkMid: '#6b6860', inkLight: '#a8a49c',
  accent: '#2D5016', accentL: '#E8F0DE', accentM: '#4a7c28',
  amber: '#C8841A', amberL: '#FDF3E0',
  red: '#B03A2E', redL: '#FDECEA',
  green: '#2D6A4F', greenL: '#D8F0E7',
  r: '14px', rs: '8px',
}

const LABEL_STYLE = { display:'block', fontSize:12, fontWeight:600, color:C.inkMid, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }

function Btn({ children, onClick, v='primary', size='md', disabled, style:sx }) {
  const pad = { sm:'5px 12px', md:'9px 18px', lg:'13px 28px' }[size]
  const fs  = { sm:13, md:14, lg:15 }[size]
  const vs  = {
    primary:  { background:C.accent,   color:'#fff',     border:'none' },
    secondary:{ background:C.surface,  color:C.ink,      border:`1.5px solid ${C.border}` },
    ghost:    { background:'transparent', color:C.inkMid, border:'none' },
    danger:   { background:C.redL,     color:C.red,      border:'none' },
    success:  { background:C.greenL,   color:C.green,    border:'none' },
    amber:    { background:C.amberL,   color:C.amber,    border:'none' },
  }[v] || {}
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:'inline-flex', alignItems:'center', gap:6, padding:pad, fontSize:fs, fontWeight:500, borderRadius:C.rs, cursor:disabled?'not-allowed':'pointer', opacity:disabled?.5:1, transition:'all .15s', whiteSpace:'nowrap', ...vs, ...sx }}>
      {children}
    </button>
  )
}

function Inp({ label, value, onChange, placeholder, type='text', multi, req }) {
  const base = { width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`, borderRadius:C.rs, fontSize:14, color:C.ink, background:C.bg, outline:'none', fontFamily:'DM Sans' }
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={LABEL_STYLE}>{label}{req?' *':''}</label>}
      {multi
        ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} style={{ ...base, resize:'vertical' }} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={base} />}
    </div>
  )
}

function Sel({ label, value, onChange, opts }) {
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={LABEL_STYLE}>{label}</label>}
      <select value={value} onChange={onChange}
        style={{ width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`, borderRadius:C.rs, fontSize:14, background:C.bg, outline:'none', appearance:'none' }}>
        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}

function Badge({ children, c='neutral' }) {
  const map = { neutral:{bg:'#F0EDE6',fg:C.inkMid}, green:{bg:C.greenL,fg:C.green}, red:{bg:C.redL,fg:C.red}, amber:{bg:C.amberL,fg:C.amber}, accent:{bg:C.accentL,fg:C.accent} }
  const { bg, fg } = map[c] || map.neutral
  return <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:99, fontSize:12, fontWeight:500, background:bg, color:fg }}>{children}</span>
}

function Card({ children, style:sx, onClick, hover }) {
  return (
    <div className={hover?'hoverable':''} onClick={onClick}
      style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:C.r, padding:20, marginBottom:14, ...sx }}>
      {children}
    </div>
  )
}

function Spinner() {
  return <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
    <div style={{ width:26, height:26, border:`3px solid ${C.border}`, borderTopColor:C.accent, borderRadius:'50%', animation:'spin .8s linear infinite' }} />
  </div>
}

function Err({ msg }) {
  return msg ? <div style={{ color:C.red, fontSize:13, marginTop:6, padding:'8px 12px', background:C.redL, borderRadius:C.rs }}>{msg}</div> : null
}

const AMENITY_ICONS = { wifi:'📶', parking:'🅿️', gym:'🏋️', laundry:'🫧', kitchen:'🍳', ac:'❄️' }
const AMENITIES     = ['wifi','parking','gym','laundry','kitchen','ac']

function ListingCard({ listing:l, onView }) {
  return (
    <Card hover onClick={onView} style={{ padding:0, overflow:'hidden' }}>
      <div style={{ height:5, background: l.type==='on_campus'?C.accent:C.amber }} />
      <div style={{ padding:'16px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'DM Serif Display', fontSize:17, marginBottom:4 }}>{l.title}</div>
            <div style={{ fontSize:13, color:C.inkMid, marginBottom:10 }}>📍 {l.location} · {l.distance_km} km from campus</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Badge c={l.type==='on_campus'?'accent':'amber'}>{l.type==='on_campus'?'🏫 On campus':'🏙️ Off campus'}</Badge>
              <Badge>{l.room_type==='single'?'🚪 Single':'🛏️ Shared'}</Badge>
              <Badge>{l.spots} spot{l.spots!==1?'s':''} left</Badge>
              {l.amenities?.slice(0,3).map(a=><Badge key={a}>{AMENITY_ICONS[a]} {a}</Badge>)}
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily:'DM Serif Display', fontSize:24, color:C.accent }}>${l.price}</div>
            <div style={{ fontSize:12, color:C.inkLight }}>/month</div>
            <Btn size="sm" style={{ marginTop:10 }} onClick={e=>{e.stopPropagation();onView()}}>View →</Btn>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function App() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [page,    setPage]    = useState('home')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async fbUser => {
      setUser(fbUser)
      if (fbUser) {
        const p = await getMyProfile(fbUser.uid)
        setProfile(p)
        setPage(p ? 'home' : 'onboarding')
      } else {
        setProfile(null); setPage('login')
      }
      setLoading(false)
    })
  }, [])

  const go = setPage

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, background:C.bg }}>
      <div style={{ fontFamily:'DM Serif Display', fontSize:28, color:C.accent }}>CampusHousing</div>
      <Spinner />
    </div>
  )

  if (!user || page==='login')          return <LoginPage />
  if (page==='onboarding' || !profile)  return <OnboardingPage user={user} onComplete={p=>{setProfile(p);go('home')}} />

  let chatArgs=null, detailId=null
  if (page.startsWith('chat|'))    { const [,lid,oid,t]=page.split('|'); chatArgs={listingId:lid,otherId:oid,title:decodeURIComponent(t)} }
  if (page.startsWith('listing|')) { detailId=page.split('|')[1] }

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <Nav profile={profile} page={page} go={go} />
      <main style={{ maxWidth:860, margin:'0 auto', padding:'28px 20px' }}>
        {page==='home'       && <HomePage profile={profile} onView={id=>go('listing|'+id)} />}
        {page==='search'     && <SearchPage profile={profile} onView={id=>go('listing|'+id)} />}
        {page==='myapps'     && <MyApplicationsPage profile={profile} onChat={(lid,oid,t)=>go(`chat|${lid}|${oid}|${encodeURIComponent(t)}`)} />}
        {page==='newlisting' && <NewListingPage profile={profile} onDone={()=>go('mylistings')} />}
        {page==='mylistings' && <MyListingsPage profile={profile} />}
        {page==='inbox'      && <InboxPage profile={profile} onChat={(lid,sid,t)=>go(`chat|${lid}|${sid}|${encodeURIComponent(t)}`)} />}
        {detailId            && <DetailPage listingId={detailId} profile={profile} onBack={()=>go('home')} onApplied={()=>go('myapps')} />}
        {chatArgs            && <ChatPage {...chatArgs} myId={profile.id} onBack={()=>go('home')} />}
      </main>
    </div>
  )
}

function Nav({ profile, page, go }) {
  const active = p => ({ color: page===p||page.startsWith(p+'|') ? C.accent : C.inkMid, fontWeight: page===p ? 600 : 400 })
  return (
    <header style={{ background:C.surface, borderBottom:`1.5px solid ${C.border}`, position:'sticky', top:0, zIndex:100 }}>
      <div style={{ maxWidth:860, margin:'0 auto', padding:'0 20px', height:56, display:'flex', alignItems:'center', gap:4 }}>
        <div style={{ fontFamily:'DM Serif Display', fontSize:20, color:C.accent, marginRight:14, cursor:'pointer', flexShrink:0 }} onClick={()=>go('home')}>
          🏠 CampusHousing
        </div>
        <Btn v="ghost" size="sm" style={active('home')}    onClick={()=>go('home')}>Home</Btn>
        <Btn v="ghost" size="sm" style={active('search')}  onClick={()=>go('search')}>Search</Btn>
        {profile?.role==='student'  && <Btn v="ghost" size="sm" style={active('myapps')}  onClick={()=>go('myapps')}>My Applications</Btn>}
        {profile?.role==='landlord' && <Btn v="ghost" size="sm" style={active('mylistings')} onClick={()=>go('mylistings')}>My Listings</Btn>}
        {profile?.role==='landlord' && <Btn v="ghost" size="sm" style={active('inbox')}   onClick={()=>go('inbox')}>Inbox</Btn>}
        <div style={{ flex:1 }} />
        <div style={{ width:30, height:30, borderRadius:'50%', background:C.accentL, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:C.accent, fontSize:13, marginRight:8 }}>
          {profile?.name?.[0]?.toUpperCase()||'?'}
        </div>
        {profile?.role==='landlord' && <Btn size="sm" onClick={()=>go('newlisting')} style={{ marginRight:6 }}>+ List Room</Btn>}
        <Btn v="ghost" size="sm" onClick={logout}>Sign out</Btn>
      </div>
    </header>
  )
}

function LoginPage() {
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="fadeUp" style={{ textAlign:'center', maxWidth:400, padding:24 }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🏠</div>
        <h1 style={{ fontFamily:'DM Serif Display', fontSize:46, lineHeight:1.1, marginBottom:12 }}>
          Find your<br /><em>campus home</em>
        </h1>
        <p style={{ color:C.inkMid, fontSize:16, lineHeight:1.65, marginBottom:36 }}>
          The simplest way for students to find housing — and for landlords to find great tenants.
        </p>
        <Btn size="lg" onClick={signInWithGoogle} style={{ gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Btn>
        <p style={{ marginTop:14, fontSize:12, color:C.inkLight }}>Free for students. Free for landlords.</p>
      </div>
    </div>
  )
}

function OnboardingPage({ user, onComplete }) {
  const [step,   setStep]   = useState(0)
  const [form,   setForm]   = useState({ role:'', name:user.displayName||'', location:'', housing_pref:'both' })
  const [err,    setErr]    = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function finish() {
    if (!form.name||!form.location) return setErr('Please fill in all fields')
    setSaving(true)
    try { await saveProfile(user.uid,form); onComplete({id:user.uid,...form}) }
    catch(e) { setErr(e.message); setSaving(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'100%', maxWidth:460, padding:24 }}>
        {/* Progress */}
        <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:32 }}>
          {[0,1].map(i=><div key={i} style={{ width:i===step?24:8, height:8, borderRadius:99, background:i===step?C.accent:C.border, transition:'all .2s' }}/>)}
        </div>

        {step===0 && (
          <div className="fadeUp">
            <h2 style={{ fontFamily:'DM Serif Display', fontSize:32, marginBottom:8 }}>Welcome! 👋</h2>
            <p style={{ color:C.inkMid, marginBottom:28 }}>What brings you here today?</p>
            {[
              { val:'student',  icon:'🎓', title:"I'm a Student",  sub:'Looking for housing near campus' },
              { val:'landlord', icon:'🏢', title:"I'm a Landlord", sub:'I have rooms to list and rent' },
            ].map(opt=>(
              <div key={opt.val} className="hoverable" onClick={()=>{set('role',opt.val);setStep(1)}}
                style={{ border:`2px solid ${form.role===opt.val?C.accent:C.border}`, borderRadius:C.r, padding:'18px 20px', display:'flex', alignItems:'center', gap:16, background:form.role===opt.val?C.accentL:C.surface, marginBottom:12 }}>
                <span style={{ fontSize:32 }}>{opt.icon}</span>
                <div><div style={{ fontWeight:600, fontSize:16 }}>{opt.title}</div><div style={{ fontSize:13, color:C.inkMid }}>{opt.sub}</div></div>
              </div>
            ))}
          </div>
        )}

        {step===1 && (
          <div className="fadeUp">
            <h2 style={{ fontFamily:'DM Serif Display', fontSize:32, marginBottom:8 }}>About you</h2>
            <p style={{ color:C.inkMid, marginBottom:24 }}>Quick details to personalise your experience.</p>
            <Inp label="Your name" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Alex Johnson" req />
            <Inp label="Your campus / city" value={form.location} onChange={e=>set('location',e.target.value)} placeholder="e.g. MIT Cambridge" req />
            {form.role==='student' && (
              <div style={{ marginBottom:20 }}>
                <label style={LABEL_STYLE}>Housing preference</label>
                <div style={{ display:'flex', gap:10 }}>
                  {[{v:'on_campus',l:'🏫 On campus'},{v:'off_campus',l:'🏙️ Off campus'},{v:'both',l:'✨ Both'}].map(o=>(
                    <div key={o.v} onClick={()=>set('housing_pref',o.v)}
                      style={{ flex:1, textAlign:'center', padding:'10px 6px', borderRadius:C.rs, border:`2px solid ${form.housing_pref===o.v?C.accent:C.border}`, background:form.housing_pref===o.v?C.accentL:C.surface, cursor:'pointer', fontSize:13, fontWeight:500 }}>
                      {o.l}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Err msg={err} />
            <div style={{ display:'flex', gap:10 }}>
              <Btn v="secondary" onClick={()=>setStep(0)}>← Back</Btn>
              <Btn onClick={finish} disabled={saving}>{saving?'Saving...':'Get started →'}</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HomePage({ profile, onView }) {
  const [listings, setListings] = useState([])
  const [loading,  setLoading]  = useState(true)
  useEffect(()=>{ getSuggestions(profile).then(d=>{setListings(d);setLoading(false)}) },[])
  return (
    <div>
      <div className="fadeUp" style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:'DM Serif Display', fontSize:36, marginBottom:6 }}>Good to see you, {profile.name?.split(' ')[0]} 👋</h1>
        <p style={{ color:C.inkMid, fontSize:15 }}>
          {profile.role==='student'
            ? `Showing ${profile.housing_pref==='both'?'all':profile.housing_pref.replace('_',' ')} listings, sorted by distance.`
            : 'Browse listings or manage your own rooms.'}
        </p>
      </div>
      {loading && <Spinner />}
      {!loading && listings.length===0 && (
        <Card><div style={{ textAlign:'center', padding:24, color:C.inkMid }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🏗️</div>
          <div style={{ fontWeight:600 }}>No listings yet — check back soon!</div>
        </div></Card>
      )}
      {listings.map((l,i)=>(
        <div key={l.id} className={`fadeUp delay${Math.min(i+1,4)}`}>
          <ListingCard listing={l} onView={()=>onView(l.id)} />
        </div>
      ))}
    </div>
  )
}

function SearchPage({ profile, onView }) {
  const [f,  setF]        = useState({ maxPrice:'', roomType:'', type:'', amenity:'' })
  const [results, setR]   = useState([])
  const [searched, setSd] = useState(false)
  const [loading, setL]   = useState(false)
  const set = (k,v) => setF(prev=>({...prev,[k]:v}))

  async function search() {
    setL(true)
    const d = await searchListings({ maxPrice:f.maxPrice?Number(f.maxPrice):null, roomType:f.roomType||null, type:f.type||null, amenity:f.amenity||null })
    setR(d); setSd(true); setL(false)
  }

  return (
    <div>
      <div className="fadeUp" style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'DM Serif Display', fontSize:36, marginBottom:6 }}>Search Listings</h1>
        <p style={{ color:C.inkMid }}>Mix and match filters — all are optional.</p>
      </div>
      <Card style={{ background:C.accentL, marginBottom:24 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:14, marginBottom:14 }}>
          <Inp label="Max price/month ($)" type="number" value={f.maxPrice} onChange={e=>set('maxPrice',e.target.value)} placeholder="e.g. 1200" />
          <Sel label="Room type" value={f.roomType} onChange={e=>set('roomType',e.target.value)} opts={[{v:'',l:'Any type'},{v:'single',l:'🚪 Single'},{v:'shared',l:'🛏️ Shared'}]} />
          <Sel label="Campus" value={f.type} onChange={e=>set('type',e.target.value)} opts={[{v:'',l:'Any'},{v:'on_campus',l:'🏫 On campus'},{v:'off_campus',l:'🏙️ Off campus'}]} />
          <Sel label="Amenity" value={f.amenity} onChange={e=>set('amenity',e.target.value)} opts={[{v:'',l:'Any amenity'},...AMENITIES.map(a=>({v:a,l:`${AMENITY_ICONS[a]} ${a}`}))]} />
        </div>
        <Btn onClick={search}>🔍 Search</Btn>
      </Card>
      {loading && <Spinner />}
      {searched && !loading && results.length===0 && <Card><div style={{ textAlign:'center', padding:16, color:C.inkMid }}>No results. Try loosening your filters.</div></Card>}
      {results.map(l=><ListingCard key={l.id} listing={l} onView={()=>onView(l.id)} />)}
    </div>
  )
}

function DetailPage({ listingId, profile, onBack, onApplied }) {
  const [listing, setListing]   = useState(null)
  const [priority, setPriority] = useState(3)
  const [msg, setMsg]           = useState('')
  const [applied, setApplied]   = useState(false)
  const [err, setErr]           = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(()=>{
    import('./supabase').then(({supabase})=>{
      supabase.from('listings').select('*, profiles(name)').eq('id',listingId).single().then(({data})=>setListing(data))
    })
  },[listingId])

  async function apply() {
    setSaving(true); setErr('')
    try { await applyToListing(profile.id,listingId,{priority,message:msg}); setApplied(true); setTimeout(onApplied,1800) }
    catch(e) { setErr(e.message); setSaving(false) }
  }

  if (!listing) return <Spinner />

  return (
    <div className="fadeUp" style={{ maxWidth:640 }}>
      <Btn v="ghost" size="sm" onClick={onBack} style={{ marginBottom:16 }}>← Back</Btn>
      <div style={{ height:5, background:listing.type==='on_campus'?C.accent:C.amber, borderRadius:99, marginBottom:20 }} />
      <h1 style={{ fontFamily:'DM Serif Display', fontSize:34, marginBottom:10 }}>{listing.title}</h1>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        <Badge c={listing.type==='on_campus'?'accent':'amber'}>{listing.type==='on_campus'?'🏫 On campus':'🏙️ Off campus'}</Badge>
        <Badge>{listing.room_type==='single'?'🚪 Single':'🛏️ Shared'}</Badge>
        <Badge c="green">{listing.spots} spot{listing.spots!==1?'s':''} available</Badge>
        {listing.amenities?.map(a=><Badge key={a}>{AMENITY_ICONS[a]} {a}</Badge>)}
      </div>
      <Card>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:listing.description?16:0 }}>
          <div>
            <div style={LABEL_STYLE}>Monthly Rent</div>
            <div style={{ fontFamily:'DM Serif Display', fontSize:30, color:C.accent }}>${listing.price}<span style={{ fontSize:14, color:C.inkMid, fontFamily:'DM Sans' }}>/mo</span></div>
          </div>
          <div>
            <div style={LABEL_STYLE}>Location</div>
            <div style={{ fontSize:14 }}>📍 {listing.location}</div>
            <div style={{ fontSize:13, color:C.inkMid }}>{listing.distance_km} km from campus</div>
          </div>
        </div>
        {listing.description && <p style={{ color:C.inkMid, fontSize:14, lineHeight:1.7, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>{listing.description}</p>}
        <div style={{ marginTop:10, fontSize:13, color:C.inkLight }}>Listed by {listing.profiles?.name}</div>
      </Card>

      {profile.role==='student' && !applied && (
        <Card>
          <h3 style={{ fontFamily:'DM Serif Display', fontSize:22, marginBottom:16 }}>Apply for this listing</h3>
          <div style={{ marginBottom:16 }}>
            <label style={LABEL_STYLE}>Your priority (1 = most important to you)</label>
            <div style={{ display:'flex', gap:8 }}>
              {[1,2,3,4,5].map(n=>(
                <div key={n} onClick={()=>setPriority(n)}
                  style={{ width:40, height:40, borderRadius:C.rs, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, cursor:'pointer', border:`2px solid ${priority===n?C.accent:C.border}`, background:priority===n?C.accentL:C.surface, color:priority===n?C.accent:C.inkMid }}>
                  {n}
                </div>
              ))}
            </div>
          </div>
          <Inp label="Message to landlord (optional)" multi value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Introduce yourself, mention move-in date..." />
          <Err msg={err} />
          <Btn onClick={apply} disabled={saving}>{saving?'Sending...':'Send Application 📨'}</Btn>
        </Card>
      )}
      {applied && (
        <Card style={{ background:C.greenL, border:`1.5px solid ${C.green}`, textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
          <div style={{ fontWeight:600, color:C.green, fontSize:16 }}>Application sent! Redirecting...</div>
        </Card>
      )}
    </div>
  )
}

function MyApplicationsPage({ profile, onChat }) {
  const [apps, setApps]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    getMyApplications(profile.id).then(d=>{setApps(d);setLoading(false)})
    const unsub = subscribeToApplications(profile.id, updated=>{
      setApps(prev=>prev.map(a=>a.id===updated.id?{...a,...updated}:a))
    })
    return unsub
  },[])

  const statusBadge = s => {
    if (s==='accepted') return <Badge c="green">✅ Accepted</Badge>
    if (s==='rejected') return <Badge c="red">❌ Rejected</Badge>
    return <Badge c="amber">⏳ Pending</Badge>
  }

  return (
    <div>
      <div className="fadeUp" style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'DM Serif Display', fontSize:36, marginBottom:6 }}>My Applications</h1>
        <p style={{ color:C.inkMid }}>Your top 5 by priority. Updates live when a landlord responds.</p>
      </div>
      {loading && <Spinner />}
      {!loading && apps.length===0 && (
        <Card><div style={{ textAlign:'center', padding:24, color:C.inkMid }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📭</div>
          <div style={{ fontWeight:600, marginBottom:6 }}>No applications yet</div>
          <div style={{ fontSize:13 }}>Browse listings and apply to get started.</div>
        </div></Card>
      )}
      {apps.map((a,i)=>(
        <Card key={a.id} style={{ borderLeft:`4px solid ${a.status==='accepted'?C.green:a.status==='rejected'?C.red:C.border}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'DM Serif Display', fontSize:18, marginBottom:4 }}>{a.listings?.title}</div>
              <div style={{ fontSize:13, color:C.inkMid, marginBottom:10 }}>
                📍 {a.listings?.location} · ${a.listings?.price}/mo · {a.listings?.room_type}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                {statusBadge(a.status)}
                <Badge>Priority {a.priority}</Badge>
              </div>
              {a.status==='accepted' && (
                <div style={{ marginTop:12 }}>
                  <Btn size="sm" v="success" onClick={()=>onChat(a.listing_id, a.listings?.landlord_id, a.listings?.title)}>💬 Chat with landlord</Btn>
                </div>
              )}
            </div>
            <div style={{ fontFamily:'DM Serif Display', fontSize:24, color:C.accentM, opacity:.4 }}>#{i+1}</div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function NewListingPage({ profile, onDone }) {
  const [form, setForm]     = useState({ title:'', description:'', location:'', type:'off_campus', room_type:'single', price:'', spots:'1', distance_km:'', amenities:[] })
  const [err, setErr]       = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const toggleA = a => set('amenities', form.amenities.includes(a)?form.amenities.filter(x=>x!==a):[...form.amenities,a])

  async function submit() {
    if (!form.title||!form.location||!form.price||!form.distance_km) return setErr('Title, location, price and distance are required')
    setSaving(true)
    try { await createListing(profile.id,form); onDone() }
    catch(e) { setErr(e.message); setSaving(false) }
  }

  return (
    <div className="fadeUp" style={{ maxWidth:580 }}>
      <h1 style={{ fontFamily:'DM Serif Display', fontSize:36, marginBottom:6 }}>Create New Listing</h1>
      <p style={{ color:C.inkMid, marginBottom:24 }}>Fill in the details about your room.</p>
      <Card>
        <Inp label="Title" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Cozy room near MIT campus" req />
        <Inp label="Location" value={form.location} onChange={e=>set('location',e.target.value)} placeholder="e.g. 123 Main St, Cambridge MA" req />
        <Inp label="Description (optional)" multi value={form.description} onChange={e=>set('description',e.target.value)} placeholder="What makes your place special?" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Inp label="Monthly Rent ($)" type="number" value={form.price} onChange={e=>set('price',e.target.value)} req />
          <Inp label="Available Spots" type="number" value={form.spots} onChange={e=>set('spots',e.target.value)} />
          <Inp label="Distance from campus (km)" type="number" value={form.distance_km} onChange={e=>set('distance_km',e.target.value)} placeholder="e.g. 1.5" req />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Sel label="Campus type" value={form.type} onChange={e=>set('type',e.target.value)} opts={[{v:'on_campus',l:'🏫 On campus'},{v:'off_campus',l:'🏙️ Off campus'}]} />
          <Sel label="Room type"   value={form.room_type} onChange={e=>set('room_type',e.target.value)} opts={[{v:'single',l:'🚪 Single'},{v:'shared',l:'🛏️ Shared'}]} />
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={LABEL_STYLE}>Amenities</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {AMENITIES.map(a=>(
              <div key={a} onClick={()=>toggleA(a)}
                style={{ padding:'7px 14px', borderRadius:99, cursor:'pointer', fontSize:13, fontWeight:500, border:`2px solid ${form.amenities.includes(a)?C.accent:C.border}`, background:form.amenities.includes(a)?C.accentL:C.surface, color:form.amenities.includes(a)?C.accent:C.inkMid }}>
                {AMENITY_ICONS[a]} {a}
              </div>
            ))}
          </div>
        </div>
        <Err msg={err} />
        <div style={{ display:'flex', gap:10 }}>
          <Btn v="secondary" onClick={onDone}>Cancel</Btn>
          <Btn onClick={submit} disabled={saving}>{saving?'Posting...':'Post Listing 🚀'}</Btn>
        </div>
      </Card>
    </div>
  )
}

function MyListingsPage({ profile }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading]   = useState(true)
  useEffect(()=>{ getMyListings(profile.id).then(d=>{setListings(d);setLoading(false)}) },[])
  return (
    <div>
      <div className="fadeUp" style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'DM Serif Display', fontSize:36, marginBottom:6 }}>My Listings</h1>
        <p style={{ color:C.inkMid }}>All rooms and units you've posted.</p>
      </div>
      {loading && <Spinner />}
      {!loading && listings.length===0 && (
        <Card><div style={{ textAlign:'center', padding:24, color:C.inkMid }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🏗️</div>
          <div style={{ fontWeight:600 }}>No listings yet. Post your first room!</div>
        </div></Card>
      )}
      {listings.map(l=>(
        <Card key={l.id}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:'DM Serif Display', fontSize:18, marginBottom:4 }}>{l.title}</div>
              <div style={{ fontSize:13, color:C.inkMid, marginBottom:8 }}>📍 {l.location} · {l.distance_km} km</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <Badge c={l.type==='on_campus'?'accent':'amber'}>{l.type?.replace('_',' ')}</Badge>
                <Badge>{l.room_type}</Badge>
                <Badge c="green">{l.spots} spots</Badge>
              </div>
            </div>
            <div style={{ fontFamily:'DM Serif Display', fontSize:26, color:C.accent }}>${l.price}<span style={{ fontSize:13, color:C.inkMid, fontFamily:'DM Sans' }}>/mo</span></div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function InboxPage({ profile, onChat }) {
  const [apps, setApps]       = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(()=>{ getApplicationsForLandlord(profile.id).then(d=>{setApps(d);setLoading(false)}) },[])

  async function respond(appId, status) {
    await updateApplicationStatus(appId,status)
    setApps(prev=>prev.map(a=>a.id===appId?{...a,status}:a))
  }

  const statusBadge = s => {
    if (s==='accepted') return <Badge c="green">✅ Accepted</Badge>
    if (s==='rejected') return <Badge c="red">❌ Rejected</Badge>
    return <Badge c="amber">⏳ Pending</Badge>
  }

  return (
    <div>
      <div className="fadeUp" style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'DM Serif Display', fontSize:36, marginBottom:6 }}>Applications Inbox</h1>
        <p style={{ color:C.inkMid }}>Review and respond to student applications.</p>
      </div>
      {loading && <Spinner />}
      {!loading && apps.length===0 && (
        <Card><div style={{ textAlign:'center', padding:24, color:C.inkMid }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📭</div>
          <div style={{ fontWeight:600 }}>No applications yet</div>
          <div style={{ fontSize:13 }}>Students will appear here once they apply to your listings.</div>
        </div></Card>
      )}
      {apps.map((a,i)=>(
        <Card key={a.id} style={{ borderLeft:`4px solid ${a.status==='accepted'?C.green:a.status==='rejected'?C.red:C.border}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:C.accentL, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:C.accent }}>
                  {a.profiles?.name?.[0]?.toUpperCase()||'?'}
                </div>
                <div>
                  <div style={{ fontWeight:600 }}>{a.profiles?.name||'Unknown student'}</div>
                  <div style={{ fontSize:12, color:C.inkMid }}>applied to: {a.listings?.title}</div>
                </div>
              </div>
              {a.message && <div style={{ fontSize:13, color:C.inkMid, fontStyle:'italic', background:C.bg, padding:'8px 12px', borderRadius:C.rs, marginBottom:10 }}>"{a.message}"</div>}
              {statusBadge(a.status)}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
              {a.status==='pending' && (
                <>
                  <Btn size="sm" v="success" onClick={()=>respond(a.id,'accepted')}>✓ Accept</Btn>
                  <Btn size="sm" v="danger"  onClick={()=>respond(a.id,'rejected')}>✗ Reject</Btn>
                </>
              )}
              {a.status==='accepted' && (
                <Btn size="sm" v="success" onClick={()=>onChat(a.listing_id,a.student_id,a.listings?.title)}>💬 Chat</Btn>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function ChatPage({ listingId, otherId, myId, title, onBack }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const bottomRef = useRef(null)

  useEffect(()=>{
    getChatMessages(listingId,myId,otherId).then(d=>{setMessages(d);setLoading(false)})
    const unsub = subscribeToChat(listingId, msg=>{ setMessages(prev=>[...prev,msg]) })
    return unsub
  },[listingId,myId,otherId])

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages])

  async function send() {
    const text=input.trim(); if(!text) return
    setInput('')
    await sendMessage(listingId,myId,otherId,text)
  }

  const fmt = ts => new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})

  return (
    <div style={{ maxWidth:560 }}>
      <Btn v="ghost" size="sm" onClick={onBack} style={{ marginBottom:16 }}>← Back</Btn>
      <div className="fadeUp">
        <h1 style={{ fontFamily:'DM Serif Display', fontSize:30, marginBottom:4 }}>💬 Chat</h1>
        {title && <p style={{ color:C.inkMid, fontSize:13, marginBottom:20 }}>Re: {title}</p>}
      </div>
      <Card style={{ padding:0 }}>
        <div style={{ height:420, overflowY:'auto', padding:16 }}>
          {loading && <Spinner />}
          {!loading && messages.length===0 && (
            <div style={{ textAlign:'center', color:C.inkLight, marginTop:80 }}>No messages yet. Say hello! 👋</div>
          )}
          {messages.map(m=>{
            const mine = m.sender_id===myId
            return (
              <div key={m.id} style={{ marginBottom:10, display:'flex', flexDirection:mine?'row-reverse':'row', alignItems:'flex-end', gap:8 }}>
                <div style={{ maxWidth:'72%', padding:'10px 14px', fontSize:14, lineHeight:1.5, borderRadius:mine?'18px 18px 4px 18px':'18px 18px 18px 4px', background:mine?C.accent:C.bg, color:mine?'#fff':C.ink }}>
                  {m.content}
                  <div style={{ fontSize:11, opacity:.55, marginTop:3, textAlign:mine?'left':'right' }}>{fmt(m.created_at)}</div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ borderTop:`1.5px solid ${C.border}`, padding:'12px 16px', display:'flex', gap:10 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
            placeholder="Type a message..."
            style={{ flex:1, padding:'10px 14px', border:`1.5px solid ${C.border}`, borderRadius:C.rs, fontSize:14, background:C.bg, outline:'none', fontFamily:'DM Sans' }} />
          <Btn onClick={send}>Send</Btn>
        </div>
      </Card>
    </div>
  )
}
