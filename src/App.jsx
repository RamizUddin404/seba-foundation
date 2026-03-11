import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

const SUPABASE_URL = "https://xpylwvyjhxomxhqhacxa.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhweWx3dnlqaHhvbXhocWhhY3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDY2NjQsImV4cCI6MjA4ODcyMjY2NH0.oSAwXxDzarxbl8C2THyOxUm-4q_2aPsCq1rzLsXt8Lw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function App() {
  const [session, setSession] = useState(null);
  const [requests, setRequests] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState({
    full_name: '',
    blood_group: '',
    phone: '',
    location: '',
    address: '',
    bio: '',
    status: 'Active Donor',
    avatar_url: ''
  });
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [authView, setAuthView] = useState('login');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBG, setFilterBG] = useState('All');
  const [selectedUser, setSelectedUser] = useState(null);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const isAdmin = myProfile?.role === 'admin' || session?.user?.email === 'admin@seba.com';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) syncData();
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) syncData();
      if (event === 'PASSWORD_RECOVERY') setAuthView('reset');
    });

    const requestsSub = supabase
      .channel('blood_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    const profilesSub = supabase
      .channel('profiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchProfiles();
      })
      .subscribe();

    return () => {
      authSub.unsubscribe();
      supabase.removeChannel(requestsSub);
      supabase.removeChannel(profilesSub);
    };
  }, []);

  const syncData = async () => {
    fetchRequests();
    fetchProfiles();
    fetchMyProfile();
  };

  const fetchRequests = async () => {
    const { data } = await supabase.from('blood_requests').select('*').order('created_at', { ascending: false });
    if (data) setRequests(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setProfiles(data);
  };

  const fetchMyProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) setMyProfile(data);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
    if (uploadError) {
      alert('ফটো আপলোড ব্যর্থ হয়েছে! অনুগ্রহ করে সুপাবেস স্টোরেজে "avatars" বাকেটটি চেক করুন।');
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);
    
    if (!updateError) {
      setMyProfile({ ...myProfile, avatar_url: publicUrl });
      alert('প্রোফাইল ফটো আপডেট হয়েছে! ✨');
    }
    setLoading(false);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target);
    const upd = {
      id: session.user.id,
      full_name: fd.get('name'),
      blood_group: fd.get('bgroup'),
      phone: fd.get('phone'),
      location: fd.get('loc'),
      address: fd.get('address'),
      bio: fd.get('bio'),
      status: fd.get('status'),
      updated_at: new Date()
    };

    const { error } = await supabase.from('profiles').upsert(upd);
    if (!error) {
      alert('প্রোফাইল সফলভাবে সেভ হয়েছে! ✨');
      fetchMyProfile();
    } else alert(error.message);
    setLoading(false);
  };

  const stats = useMemo(() => ({
    live: requests.filter(r => r.status === 'pending').length,
    success: requests.filter(r => r.status === 'completed').length,
    total: profiles.length
  }), [requests, profiles]);

  if (!session && authView !== 'reset') return (
    <div className="auth-container">
      <div className="auth-card glass animate-fade">
        <div className="auth-header"><h1>SEBA</h1><p>Digital Blood Network</p></div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const fd = new FormData(e.target);
          const email = fd.get('email');
          const pass = fd.get('password');
          if (authView === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (error) alert(error.message);
          } else {
            const { error } = await supabase.auth.signUp({ 
              email, 
              password: pass, 
              options: { 
                data: { 
                  full_name: fd.get('name'), 
                  blood_group: fd.get('bgroup') 
                } 
              } 
            });
            if (error) alert(error.message); else alert('সফল! এখন লগইন করুন।');
          }
          setLoading(false);
        }}>
          {authView === 'signup' && (
            <>
              <input name="name" placeholder="আপনার নাম" required />
              <select name="bgroup" required><option value="">রক্তের গ্রুপ</option>{bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}</select>
            </>
          )}
          <input name="email" type="email" placeholder="ইমেইল" required />
          <input name="password" type="password" placeholder="পাসওয়ার্ড" required minLength={6} />
          <button type="submit" className="btn-primary" disabled={loading}>{authView === 'login' ? 'লগইন' : 'জয়েন করুন'}</button>
        </form>
        <p className="auth-footer" onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')}>
          {authView === 'login' ? "নতুন অ্যাকাউন্ট?" : "ইতিমধ্যে জয়েন করেছেন?"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="app-main">
      <aside className="sidebar glass hide-mobile">
        <div className="logo-area" onClick={() => setActiveTab('home')}><div className="logo-icon">🩸</div><h2>SEBA</h2></div>
        <nav className="side-nav">
          <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>ড্যাশবোর্ড</li>
          <li className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>লাইভ ফিড</li>
          <li className={activeTab === 'request' ? 'active' : ''} onClick={() => setActiveTab('request')}>রক্তের আবেদন</li>
          <li className={activeTab === 'donors' ? 'active' : ''} onClick={() => setActiveTab('donors')}>রক্তদাতা তালিকা</li>
          <li className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>আমার প্রোফাইল</li>
          <li onClick={() => supabase.auth.signOut()} className="logout-btn">লগআউট</li>
        </nav>
      </aside>

      <main className="content-container">
        <header className="mobile-header show-mobile">
          <div className="logo-icon">🩸</div><h2>SEBA</h2>
          <button onClick={() => supabase.auth.signOut()} className="btn-del-sm">Out</button>
        </header>

        {activeTab === 'home' && (
          <div className="home-view animate-fade">
            <div className="hero-pro glass">
              <h1>মানবতার ডিজিটাল সেবা</h1>
              <div className="pro-stats">
                <div className="stat-item"><h3>{stats.live}</h3><p>লাইভ আবেদন</p></div>
                <div className="stat-item"><h3>{stats.success}</h3><p>সফল হয়েছে</p></div>
                <div className="stat-item"><h3>{stats.total}</h3><p>মোট সদস্য</p></div>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'2rem'}}>
               <button className="btn-primary" onClick={() => setActiveTab('request')}>জরুরী আবেদন</button>
               <button className="glass" style={{padding:'1rem'}} onClick={() => setActiveTab('donors')}>রক্তদাতা খুঁজুন</button>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="profile-view animate-fade">
            <h2 className="section-title">প্রোফাইল সেটিংস</h2>
            <div className="pro-profile-header glass">
              <div className="avatar-wrapper">
                <img src={myProfile.avatar_url || `https://ui-avatars.com/api/?name=${myProfile.full_name}&background=random`} alt="Avatar" className="avatar-large-img" />
                <label className="upload-btn">
                  📷
                  <input type="file" accept="image/*" onChange={handleUpload} style={{display:'none'}} />
                </label>
              </div>
              <div>
                <h2>{myProfile.full_name || 'আপনার নাম'}</h2>
                <p>{session?.user?.email}</p>
                <span className="badge-p">{myProfile.status}</span>
              </div>
            </div>

            <div className="glass form-container" style={{marginTop:'2rem', padding:'2.5rem'}}>
              <h3 style={{marginBottom:'1.5rem'}}>আপনার তথ্য আপডেট করুন</h3>
              <form onSubmit={saveProfile} className="pro-form">
                <div className="input-group">
                  <label>পুরো নাম</label>
                  <input name="name" defaultValue={myProfile.full_name} placeholder="আপনার নাম লিখুন" required />
                </div>
                
                <div className="row-2">
                  <div className="input-group">
                    <label>রক্তের গ্রুপ</label>
                    <select name="bgroup" defaultValue={myProfile.blood_group}>
                      <option value="">নির্বাচন করুন</option>
                      {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>মোবাইল নম্বর</label>
                    <input name="phone" defaultValue={myProfile.phone} placeholder="০১৭XXXXXXXX" required />
                  </div>
                </div>

                <div className="row-2">
                  <div className="input-group">
                    <label>শহর/এলাকা</label>
                    <input name="loc" defaultValue={myProfile.location} placeholder="উদা: ঢাকা" />
                  </div>
                  <div className="input-group">
                    <label>ডোনার স্ট্যাটাস</label>
                    <select name="status" defaultValue={myProfile.status}>
                      <option value="Active Donor">রক্ত দিতে প্রস্তুত</option>
                      <option value="Unavailable">ব্যস্ত আছি</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label>বিস্তারিত ঠিকানা</label>
                  <input name="address" defaultValue={myProfile.address} placeholder="আপনার পূর্ণ ঠিকানা লিখুন" />
                </div>

                <div className="input-group">
                  <label>বায়ো/পরিচয়</label>
                  <textarea name="bio" defaultValue={myProfile.bio} placeholder="আপনার সম্পর্কে কিছু লিখুন..."></textarea>
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'সেভ হচ্ছে...' : 'প্রোফাইল সেভ করুন'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="feed-view animate-fade">
            <h2 className="section-title">লাইভ ব্লাড ফিড</h2>
            <div className="pro-grid">
              {requests.filter(r => r.status !== 'completed').map(req => (
                <div key={req.id} className="pro-req-card glass">
                  <div className="req-header">
                    <div className="blood-badge">{req.blood_group}</div>
                    <div className="posted-by">পোস্ট করেছেন: {req.posted_by}</div>
                  </div>
                  <h3>{req.patient_name}</h3>
                  <p>📍 {req.location}</p>
                  <p>📞 {req.phone}</p>
                  <div className="req-actions">
                    {req.status === 'pending' && (
                      <button className="btn-accept" onClick={() => supabase.from('blood_requests').update({status:'accepted', accepted_by: session.user.email}).eq('id', req.id)}>আমি দিব</button>
                    )}
                    <button className="btn-call" onClick={() => window.open(`tel:${req.phone}`)}>কল</button>
                    {(req.posted_by === session?.user?.email || isAdmin) && (
                      <>
                        <button className="btn-success" onClick={() => supabase.from('blood_requests').update({status:'completed'}).eq('id', req.id)}>সফল</button>
                        <button className="btn-del-sm" onClick={() => { if(window.confirm('নিশ্চিত?')) supabase.from('blood_requests').delete().eq('id', req.id) }}>মুছুন</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'donors' && (
          <div className="donor-view animate-fade">
            <h2 className="section-title">রক্তদাতার তালিকা</h2>
            <div className="filter-area">
              <input placeholder="শহর বা নাম দিয়ে খুঁজুন..." className="glass search-input" onChange={(e) => setSearchQuery(e.target.value.toLowerCase())} />
              <select className="glass filter-select" onChange={(e) => setFilterBG(e.target.value)}>
                <option value="All">সব গ্রুপ</option>
                {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            <div className="pro-grid">
              {profiles.filter(p => (p.full_name?.toLowerCase().includes(searchQuery) || p.location?.toLowerCase().includes(searchQuery)) && (filterBG === 'All' || p.blood_group === filterBG)).map(p => (
                <div key={p.id} className="pro-donor-card glass" onClick={() => setSelectedUser(p)}>
                  <div className="donor-header">
                     <img src={p.avatar_url || `https://ui-avatars.com/api/?name=${p.full_name}&background=random`} alt="Avatar" className="donor-avatar" />
                     <div className="donor-blood-tag">{p.blood_group || '?'}</div>
                  </div>
                  <h3>{p.full_name}</h3>
                  <p>📍 {p.location || 'Unknown'}</p>
                  <span className={`status-dot ${p.status === 'Active Donor' ? 'active' : 'busy'}`}></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedUser && (
          <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
            <div className="pro-modal glass animate-fade" onClick={e => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedUser(null)}>✕</button>
              <img src={selectedUser.avatar_url || `https://ui-avatars.com/api/?name=${selectedUser.full_name}&background=random`} alt="Avatar" className="modal-avatar" />
              <div className="modal-blood-badge">{selectedUser.blood_group || '?'}</div>
              <h2>{selectedUser.full_name}</h2>
              <div className="modal-details">
                <p>📍 <strong>এলাকা:</strong> {selectedUser.location}</p>
                <p>🏠 <strong>ঠিকানা:</strong> {selectedUser.address}</p>
                <p>📞 <strong>ফোন:</strong> {selectedUser.phone}</p>
                <p>📝 <strong>বায়ো:</strong> {selectedUser.bio}</p>
                <p>⭐ <strong>স্ট্যাটাস:</strong> {selectedUser.status}</p>
              </div>
              <button className="btn-call" onClick={() => window.open(`tel:${selectedUser.phone}`)}>সরাসরি কল দিন</button>
            </div>
          </div>
        )}

        {activeTab === 'request' && (
          <div className="request-view animate-fade">
             <div className="glass form-container" style={{padding:'3rem'}}>
              <h2 style={{textAlign:'center', marginBottom:'2rem'}}>রক্তের আবেদন করুন</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                const fd = new FormData(e.target);
                const { error } = await supabase.from('blood_requests').insert([{ 
                  patient_name: fd.get('pname'), 
                  blood_group: fd.get('bgroup'), 
                  location: fd.get('loc'), 
                  phone: fd.get('phone'), 
                  posted_by: session.user.email, 
                  status: 'pending' 
                }]);
                if(!error) {
                  alert('আবেদন পোস্ট হয়েছে! 🩸'); 
                  setActiveTab('live');
                } else alert(error.message);
                setLoading(false);
              }}>
                <input name="pname" placeholder="রোগীর নাম" required />
                <div className="row-2" style={{marginTop:'1rem'}}>
                  <select name="bgroup" required><option value="">গ্রুপ</option>{bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}</select>
                  <input name="phone" placeholder="ফোন নম্বর" required />
                </div>
                <input name="loc" placeholder="হাসপাতাল ও বিস্তারিত ঠিকানা" required style={{marginTop:'1rem'}} />
                <button type="submit" className="btn-primary" style={{marginTop:'1.5rem'}} disabled={loading}>
                  {loading ? 'পোস্ট হচ্ছে...' : 'আবেদন পোস্ট করুন'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      <nav className="bottom-nav show-mobile">
        <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>🏠</li>
        <li className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>🩸</li>
        <li className={activeTab === 'request' ? 'active' : ''} onClick={() => setActiveTab('request')}>📝</li>
        <li className={activeTab === 'donors' ? 'active' : ''} onClick={() => setActiveTab('donors')}>👥</li>
        <li className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>⚙️</li>
      </nav>
    </div>
  );
}

export default App;
