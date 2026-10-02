        const original = Object.keys(map).find(k => skNormalizeLanguageText(map[k]) === normalized);
        if (original && SK_T[language]?.[original]) return SK_T[language][original];
    }

    return null;
}

function skTranslate(value, language) {
    const source = String(value ?? "");
    if (language === "en") {
        for (const map of Object.values(SK_T)) {
            const original = Object.keys(map).find(key => skNormalizeLanguageText(map[key]) === skNormalizeLanguageText(source));
            if (original) return original;
        }
        return source;
    }

    const exact = skFindExactTranslation(source, language);
    if (exact) return exact;

    if (SK_WORD_T[language]) {
        const translated = source.replace(/[A-Za-z][A-Za-z'-]*/g, word => {
            const mapped = SK_WORD_T[language][word] || skFindExactTranslation(word, language);
            return mapped || word;
        });

        return skNativeScriptFallback(translated, language);
    }

    return skNativeScriptFallback(source, language);
}

const studentKartLanguageTextOriginals = new WeakMap();
const studentKartLanguageAttributeOriginals = new WeakMap();
const studentKartLanguageLastApplied = new WeakMap();
let studentKartLanguageObserver = null;
let studentKartLanguageApplying = false;

function getStudentKartLanguageSource(node) {
    if (node.nodeType !== Node.TEXT_NODE) return "";
    if (!studentKartLanguageTextOriginals.has(node)) {
        studentKartLanguageTextOriginals.set(node, node.nodeValue || "");
    }
    return studentKartLanguageTextOriginals.get(node) || "";
}

function getStudentKartAttributeSource(node, attr) {
    if (!(node instanceof Element)) return "";
    let values = studentKartLanguageAttributeOriginals.get(node);
    if (!values) {
        values = {};
        studentKartLanguageAttributeOriginals.set(node, values);
    }
    if (!(attr in values)) {
        values[attr] = node.getAttribute(attr) || "";
    }
    return values[attr] || "";
}

function applyStudentKartLanguage(root = document) {
    const settings = getStudentKartSettings();
    const language = STUDENTKART_LANGUAGES[settings.preferences.language]
        ? settings.preferences.language
        : "en";

    document.documentElement.lang = language;
    if (studentKartLanguageApplying) return;
    studentKartLanguageApplying = true;

    const translateNode = node => {
        // Document/DocumentFragment roots do not have an Element parent,
        // so explicitly walk their children. Without this, the default
        // document-wide language pass scanned nothing.
        if (node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            [...node.childNodes].forEach(translateNode);
            return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            if (!node.parentElement || node.parentElement.closest("script,style,noscript,[data-sk-lang-skip='true']")) return;

            // Keep a permanent English source for this node. If a renderer
            // replaced its text after the first scan, refresh the source
            // whenever the current text is neither the previous source nor
            // one of the translations we already generated.
            let source = studentKartLanguageTextOriginals.get(node);
            const current = node.nodeValue || "";
            const trimmedCurrent = current.trim();

            if (!source) {
                source = current;
                studentKartLanguageTextOriginals.set(node, source);
            } else {
                const sourceTrimmed = String(source).trim();
                const knownTranslations = Object.values(SK_T).some(map => Object.values(map).includes(trimmedCurrent));
                if (
                    trimmedCurrent &&
                    trimmedCurrent !== sourceTrimmed &&
                    !knownTranslations &&
                    trimmedCurrent !== String(skTranslate(sourceTrimmed, language)).trim()
                ) {
                    source = current;
                    studentKartLanguageTextOriginals.set(node, source);
                }
            }

            const value = String(source).trim();
            if (!value) return;

            const translated = skTranslate(value, language);
            const raw = String(source);
            const leading = raw.match(/^\s*/)?.[0] || "";
            const trailing = raw.match(/\s*$/)?.[0] || "";
            const nextValue = leading + translated + trailing;

            if (node.nodeValue !== nextValue) {
                node.nodeValue = nextValue;
            }
            studentKartLanguageLastApplied.set(node, nextValue);
            return;
        }

        if (
            node.nodeType !== Node.ELEMENT_NODE ||
            node.closest("script,style,noscript") ||
            node.dataset.skLangSkip === "true"
        ) {
            return;
        }

        ["placeholder", "title", "aria-label"].forEach(attr => {
            if (!node.hasAttribute(attr)) return;

            let source = getStudentKartAttributeSource(node, attr);
            const current = node.getAttribute(attr) || "";
            const knownTranslations = Object.values(SK_T).some(map => Object.values(map).includes(current));

            if (source && current !== source && !knownTranslations) {
                source = current;
                const values = studentKartLanguageAttributeOriginals.get(node) || {};
                values[attr] = source;
                studentKartLanguageAttributeOriginals.set(node, values);
            }

            if (source) node.setAttribute(attr, skTranslate(source, language));
        });

        [...node.childNodes].forEach(translateNode);
    };

    translateNode(root);
    studentKartLanguageApplying = false;
}


function startStudentKartLanguageObserver() {
    if (studentKartLanguageObserver || !document.body) return;

    studentKartLanguageObserver = new MutationObserver(mutations => {
        const settings = getStudentKartSettings();
        if (!STUDENTKART_LANGUAGES[settings.preferences.language]) return;

        for (const mutation of mutations) {
            if (mutation.type === "characterData") {
                const node = mutation.target;
                if (node && node.nodeType === Node.TEXT_NODE) {
                    if (studentKartLanguageLastApplied.get(node) === node.nodeValue) continue;
                    applyStudentKartLanguage(node);
                }
                continue;
            }

            if (mutation.type === "attributes") {
                applyStudentKartLanguage(mutation.target);
                continue;
            }

            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
                    applyStudentKartLanguage(node);
                }
            });
        }
    });

    studentKartLanguageObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

const STUDENTKART_SETTINGS_DEFAULTS = {
    notifications: {
        chat: true,
        wishlist: true,
        listings: true,
        buyerSeller: true,
        sold: true,
        push: false
    },
    privacy: {
        profileVisibility: "students",
        hidePhone: false,
        hideEmail: false,
        blockedUsers: []
    },
    location: {
        state: "",
        city: "",
        area: "",
        latitude: null,
        longitude: null,
        distanceKm: 10
    },
    preferences: {
        theme: "light",
        language: "en",
        vibration: true
    }
};

function deepCloneSettings(value) {
    return JSON.parse(JSON.stringify(value));
}

function mergeSettings(base, extra) {
    if (!extra || typeof extra !== "object") return base;
    Object.keys(extra).forEach(key => {
        if (extra[key] && typeof extra[key] === "object" && !Array.isArray(extra[key])) {
            base[key] = mergeSettings(base[key] || {}, extra[key]);
        } else {
            base[key] = extra[key];
        }
    });
    return base;
}

function getStudentKartSettings() {
    const metadata = currentUser?.user_metadata?.studentkart_settings || {};
    let local = null;
    try {
        local = currentUser
            ? JSON.parse(localStorage.getItem(`studentkart_settings_${currentUser.id}`) || "null")
            : null;
    } catch (_) {}

    // Local settings are the latest device-side choice. Merge them over
    // account metadata so a newly selected language is never overwritten
    // by an older profile value.
    return mergeSettings(
        mergeSettings(
            deepCloneSettings(STUDENTKART_SETTINGS_DEFAULTS),
            metadata
        ),
        local || {}
    );
}

async function saveStudentKartSettings(nextSettings, silent = false) {
    if (!currentUser) return false;

    const settings = mergeSettings(
        deepCloneSettings(STUDENTKART_SETTINGS_DEFAULTS),
        nextSettings
    );

    try {
        localStorage.setItem(
            `studentkart_settings_${currentUser.id}`,
            JSON.stringify(settings)
        );
    } catch (_) {}

    // Apply the selected language/theme immediately. Do not make the UI
    // wait for the Supabase metadata request.
    applyStudentKartSettings();

    const { data, error } = await supabaseClient.auth.updateUser({
        data: {
            ...(currentUser.user_metadata || {}),
            studentkart_settings: settings
        }
    });

    if (error) {
        console.error("Settings save error:", error);
        if (!silent) showToast("Setting saved on this device", "success");
        return true;
    }

    if (data?.user) currentUser = data.user;
    if (!silent) showToast("Setting saved", "success");
    applyStudentKartSettings();
    return true;
}

function applyStudentKartSettings() {
    if (!currentUser) return;
    const settings = getStudentKartSettings();
    const theme = settings.preferences.theme === "dark";
    document.body.classList.toggle("studentkart-dark", theme);
    document.documentElement.lang = STUDENTKART_LANGUAGES[settings.preferences.language] ? settings.preferences.language : "en";
    applyStudentKartLanguage();

    const rows = {
        "chat-notifications": settings.notifications.chat,
        "wishlist-notifications": settings.notifications.wishlist,
        "listing-notifications": settings.notifications.listings,
        "buyer-seller-notifications": settings.notifications.buyerSeller,
        "sold-notifications": settings.notifications.sold,
        "push-notifications": settings.notifications.push,
        "vibration": settings.preferences.vibration,
        "hide-phone": settings.privacy.hidePhone,
        "hide-email": settings.privacy.hideEmail
    };

    Object.entries(rows).forEach(([action, enabled]) => {
        const row = document.querySelector(`[data-setting-action="${action}"]`);
        const sw = row?.querySelector(".settings-switch");
        if (sw) {
            sw.dataset.enabled = enabled ? "true" : "false";
            sw.querySelector("span")?.style.setProperty("transform", enabled ? "translateX(18px)" : "translateX(0)");
            sw.style.background = enabled ? "#0f8b8d" : "#d9e3e8";
        }
    });

    const profileVisibilityRow = document.querySelector('[data-setting-action="profile-visibility"]');
    const profileVisibilitySmall = profileVisibilityRow?.querySelector("small");
    if (profileVisibilitySmall) {
        const labels = { public: "Anyone can see your profile", students: "Visible to StudentKart users", private: "Profile visibility is limited" };
        profileVisibilitySmall.textContent = labels[settings.privacy.profileVisibility] || "Control profile visibility";
    }
    const blockedRow = document.querySelector('[data-setting-action="blocked-users"]');
    const blockedSmall = blockedRow?.querySelector("small");
    if (blockedSmall) {
        const count = Array.isArray(settings.privacy.blockedUsers) ? settings.privacy.blockedUsers.length : 0;
        blockedSmall.textContent = count ? count + " blocked account" + (count === 1 ? "" : "s") : "No blocked accounts";
    }

    const themeRow = document.querySelector('[data-setting-action="theme"]');
    const themeSmall = themeRow?.querySelector("small");
    if (themeSmall) themeSmall.textContent = theme === "dark" ? "Dark mode is active" : "Light mode is active";
}

async function settingsToggle(path) {
    const settings = getStudentKartSettings();
    const parts = path.split(".");
    let obj = settings;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    const key = parts[parts.length - 1];
    obj[key] = !Boolean(obj[key]);
    return saveStudentKartSettings(settings);
}

function openSettingsActionModal({title, description="", fields=[], options=[], danger=false, confirmText="Save", onConfirm}) {
    let modal = $("settingsActionModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "settingsActionModal";
        modal.className = "modal hidden";
        document.body.appendChild(modal);
    }

    const fieldHTML = fields.map(field => {
        const type = field.type || "text";
        if (type === "textarea") {
            return `<label class="settings-action-field"><span>${escapeHTML(field.label)}</span><textarea id="settingsAction_${escapeHTML(field.id)}" placeholder="${escapeHTML(field.placeholder || "")}">${escapeHTML(field.value || "")}</textarea></label>`;
        }
        return `<label class="settings-action-field"><span>${escapeHTML(field.label)}</span><input id="settingsAction_${escapeHTML(field.id)}" type="${type}" value="${escapeHTML(field.value || "")}" placeholder="${escapeHTML(field.placeholder || "")}"></label>`;
    }).join("");

    const optionHTML = options.length
        ? `<div class="settings-action-options">${options.map(option =>
            `<button type="button" class="settings-action-option" data-settings-option="${escapeHTML(option.value)}"><i class="fas ${escapeHTML(option.icon || "fa-circle") }"></i><span><b>${escapeHTML(option.label)}</b><small>${escapeHTML(option.description || "")}</small></span><i class="fas fa-chevron-right"></i></button>`
        ).join("")}</div>`
        : "";

    modal.innerHTML = `
        <div class="modal-overlay" data-settings-action-close></div>
        <div class="modal-content settings-action-modal-content">
            <div class="settings-action-header">
                <div>
                    <span class="section-label">STUDENTKART</span>
                    <h2>${escapeHTML(title)}</h2>
                    <p>${escapeHTML(description)}</p>
                </div>
                <button type="button" class="modal-close" data-settings-action-close aria-label="Close">&times;</button>
            </div>
            <div class="settings-action-body">${fieldHTML}${optionHTML}</div>
            <div class="settings-action-footer">
                <button type="button" class="btn btn-outline" data-settings-action-close>Cancel</button>
                ${fields.length ? `<button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" id="settingsActionConfirm">${escapeHTML(confirmText)}</button>` : ""}
            </div>
        </div>`;

    modal.querySelectorAll("[data-settings-action-close]").forEach(btn => {
        btn.addEventListener("click", () => closeModal("settingsActionModal"));
    });

    modal.querySelectorAll("[data-settings-option]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const value = btn.dataset.settingsOption;
            await onConfirm?.(value);
            closeModal("settingsActionModal");
        });
    });

    modal.querySelector("#settingsActionConfirm")?.addEventListener("click", async () => {
        const values = {};
        fields.forEach(field => {
            const el = $(`settingsAction_${field.id}`);
            values[field.id] = el?.value?.trim() || "";
        });
        const ok = await onConfirm?.(values);
        if (ok !== false) closeModal("settingsActionModal");
    });

    openModal("settingsActionModal");
}

async function settingsEmail() {
    if (!currentUser) return;
    openSettingsActionModal({
        title: "Change Email",
        description: "Update the email connected to your StudentKart account.",
        fields: [{id:"email", label:"New Email Address", type:"email", value:currentUser.email || "", placeholder:"you@example.com"}],
        confirmText: "Update Email",
        onConfirm: async values => {
            if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(values.email)) {
                showToast("Please enter a valid email address", "warning"); return false;
            }
            const {data,error}=await supabaseClient.auth.updateUser({email:values.email.toLowerCase()});
            if(error){showToast(error.message||"Could not update email","error");return false;}
            if(data?.user) currentUser=data.user;
            showToast("Email update started. Check your confirmation email if required.","success");
        }
    });
}

async function settingsMobile() {
    if (!currentUser) return;
    openSettingsActionModal({
        title: "Change Mobile Number",
        description: "Enter your mobile number with country code.",
        fields: [{id:"phone", label:"Mobile Number", type:"tel", value:currentUser.phone || "", placeholder:"+919876543210"}],
        confirmText: "Update Mobile",
        onConfirm: async values => {
            const phone=values.phone.replace(/\\s+/g,"");
            if(!/^\\+?[1-9]\\d{9,14}$/.test(phone)){showToast("Enter a valid mobile number with country code","warning");return false;}
            const {data,error}=await supabaseClient.auth.updateUser({phone});
            if(error){showToast(error.message||"Could not update mobile number","error");return false;}
            if(data?.user) currentUser=data.user;
            showToast("Mobile update started. OTP verification may be required.","success");
        }
    });
}

function settingsCollege() {
    closeModal("settingsModal");
    openEditProfile?.();
}

async function settingsLocationCurrent() {
    if (!navigator.geolocation) { showToast("Location is not supported by this browser","warning"); return; }
    showToast("Requesting your current location...","info");
    navigator.geolocation.getCurrentPosition(async position => {
        const settings=getStudentKartSettings();
        settings.location.latitude=Number(position.coords.latitude.toFixed(6));
        settings.location.longitude=Number(position.coords.longitude.toFixed(6));
        await saveStudentKartSettings(settings,true);
        showToast("Current location saved","success");
    }, error => {
        console.warn("Geolocation error",error);
        showToast("Location permission was denied or unavailable","warning");
    }, {enableHighAccuracy:true,timeout:10000,maximumAge:300000});
}

async function settingsLocationDetails() {
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Change Location",
        description:"Set the area you want StudentKart to use for local listings.",
        fields:[
            {id:"state",label:"State",value:settings.location.state},
            {id:"city",label:"City",value:settings.location.city},
            {id:"area",label:"Area",value:settings.location.area}
        ],
        confirmText:"Save Location",
        onConfirm:async values=>{
            settings.location.state=values.state;
            settings.location.city=values.city;
            settings.location.area=values.area;
            await saveStudentKartSettings(settings);
        }
    });
}

async function settingsDistance() {
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Nearby Listings Distance",
        description:"Choose how far StudentKart should search around your preferred location.",
        options:[5,10,25,50,100].map(km=>({value:String(km),label:km+" km",description:"Show listings within "+km+" km",icon:"fa-route"})),
        onConfirm:async value=>{
            settings.location.distanceKm=Number(value);
            await saveStudentKartSettings(settings);
        }
    });
}

async function settingsLocationPermission() {
    openSettingsActionModal({
        title:"Location Permission",
        description:"StudentKart uses browser location access only when you request your current location.",
        options:[
            {value:"request",label:"Request Location Access",description:"Ask the browser for location permission",icon:"fa-location-crosshairs"},
            {value:"status",label:"Check Permission Status",description:"See whether location access is allowed",icon:"fa-circle-info"}
        ],
        onConfirm:async value=>{
            if(value==="request"){ settingsLocationCurrent(); return; }
            try {
                const result=await navigator.permissions.query({name:"geolocation"});
                showToast("Location permission: "+result.state,"info");
            } catch(_) { showToast("Manage location access from your browser site settings.","info"); }
        }
    });
}

async function settingsTheme() {
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Appearance",
        description:"Choose how StudentKart should look on your device.",
        options:[
            {value:"light",label:"Light Mode",description:"Clean light StudentKart interface",icon:"fa-sun"},
            {value:"dark",label:"Dark Mode",description:"Dark interface for low-light use",icon:"fa-moon"}
        ],
        onConfirm:async value=>{settings.preferences.theme=value;await saveStudentKartSettings(settings);}
    });
}

async function settingsLanguage() {
    const settings = getStudentKartSettings();
    openSettingsActionModal({
        title: "Language",
        description: "Choose your preferred app language.",
        options: Object.entries(STUDENTKART_LANGUAGES).map(([value, label]) => ({
            value,
            label,
            description: value === "en" ? "Use English throughout the interface" : "Change StudentKart interface language",
            icon: "fa-language"
        })),
        confirmText: "Apply Language",
        onConfirm: async value => {
            settings.preferences.language = STUDENTKART_LANGUAGES[value] ? value : "en";
            const saved = await saveStudentKartSettings(settings);
            if (saved) {
                applyStudentKartLanguage();
                showToast("Language changed to " + STUDENTKART_LANGUAGES[settings.preferences.language], "success");

                // Relaunch the app so every static and dynamically generated
                // screen starts cleanly in the newly selected language.
                window.setTimeout(() => {
                    window.location.reload();
                }, 120);
            }
            return saved;
        }
    });
    window.setTimeout(() => applyStudentKartLanguage($("settingsActionModal")), 0);
}

async function settingsProfileVisibility() {
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Profile Visibility",
        description:"Choose who can discover your StudentKart profile.",
        options:[
            {value:"public",label:"Public",description:"Anyone using StudentKart can see your profile",icon:"fa-earth-asia"},
            {value:"students",label:"Students",description:"Keep your profile visible to the StudentKart community",icon:"fa-user-group"},
            {value:"private",label:"Private",description:"Limit profile visibility",icon:"fa-lock"}
        ],
        onConfirm:async value=>{settings.privacy.profileVisibility=value;await saveStudentKartSettings(settings);}
    });
}

async function settingsBlockedUsers() {
    const settings = getStudentKartSettings();
    const blocked = Array.isArray(settings.privacy?.blockedUsers)
        ? settings.privacy.blockedUsers.map(String).filter(Boolean)
        : [];

    let profiles = [];
    if (blocked.length) {
        try {
            const { data, error } = await supabaseClient
                .from("profiles")
                .select("id,name,username,email,phone,avatar_url,college,city")
                .in("id", blocked);

            if (!error && Array.isArray(data)) {
                profiles = data;
            }
        } catch (error) {
            console.error("Blocked users profile load error:", error);
        }
    }

    const profileMap = new Map(
        profiles.map(profile => [String(profile.id), profile])
    );

    const blockedOptions = blocked.map(id => {
        const profile = profileMap.get(id);
        const name =
            profile?.name ||
            profile?.username ||
            "Blocked User";
        const contact =
            profile?.username
                ? "@" + profile.username
                : profile?.email ||
                    profile?.phone ||
                    "Blocked account";

        return {
            value: "unblock:" + id,
            label: name,
            description: contact,
            icon: "fa-user-check"
        };
    });

    openSettingsActionModal({
        title: "Blocked Users",
        description: blocked.length
            ? "These accounts are blocked. Tap a user to unblock them."
            : "You have not blocked any users yet.",
        options: blockedOptions,
        fields: [{
            id: "user",
            label: "Block another user",
            placeholder: "Enter User ID"
        }],
        confirmText: "Block User",
        onConfirm: async value => {
            if (typeof value === "string" && value.startsWith("unblock:")) {
                const id = value.slice(8);

                settings.privacy = settings.privacy || {};
                settings.privacy.blockedUsers =
                    (Array.isArray(settings.privacy.blockedUsers)
                        ? settings.privacy.blockedUsers.map(String)
                        : []
                    ).filter(x => x !== id);

                const saved = await saveStudentKartSettings(settings, true);

                if (!saved) {
                    showToast("Could not unblock this user", "error");
                    return false;
                }

                showToast("User unblocked", "success");
                return;
            }

            if (value && value.user) {
                const id = value.user.trim();

                if (!id) {
                    showToast("Enter a User ID", "warning");
                    return false;
                }

                settings.privacy = settings.privacy || {};
                const currentBlocked = Array.isArray(settings.privacy.blockedUsers)
                    ? settings.privacy.blockedUsers.map(String)
                    : [];

                if (currentBlocked.includes(id)) {
                    showToast("User is already blocked", "info");
                    return false;
                }

                settings.privacy.blockedUsers = [...currentBlocked, id];

                const saved = await saveStudentKartSettings(settings, true);

                if (!saved) {
                    showToast("Could not block this user", "error");
                    return false;
                }

                showToast("User blocked", "success");
            }
        }
    });
}
async function settingsReportProblem() {
    openSettingsActionModal({
        title:"Report a Problem",
        description:"Tell us what went wrong. Your email app will open with the report ready to send.",
        fields:[
            {id:"subject",label:"Subject",value:"StudentKart Problem Report"},
            {id:"message",label:"What happened?",type:"textarea",placeholder:"Describe the problem..."}
        ],
        confirmText:"Prepare Report",
        onConfirm:async values=>{
            const subject=encodeURIComponent(values.subject||"StudentKart Problem Report");
            const body=encodeURIComponent(values.message||"");
            window.location.href="mailto:rathodharish004@gmail.com?subject="+subject+"&body="+body;
        }
    });
}

async function settingsLoginSessions() {
    const {data,error}=await supabaseClient.auth.getSession();
    const expires=data?.session?.expires_at?new Date(data.session.expires_at*1000).toLocaleString("en-IN"):"Unknown";
    openSettingsActionModal({
        title:"Login Session",
        description:error?"Could not read your current session.":"This browser currently has an active StudentKart session.",
        options:error?[]:[{value:"current",label:"Current Session Active",description:"Session expiry: "+expires,icon:"fa-circle-check"}],
        onConfirm:async()=>{}
    });
}

async function settingsLogoutAll() {
    openSettingsActionModal({
        title:"Logout From All Devices",
        description:"This will sign out the current account. Continue only if you want to end your StudentKart session.",
        options:[
            {value:"logout",label:"Logout From All Devices",description:"End the current Supabase session",icon:"fa-right-from-bracket"}
        ],
        onConfirm:async value=>{
            if(value!=="logout")return;
            const {error}=await supabaseClient.auth.signOut();
            if(error){showToast(error.message||"Could not logout","error");return;}
            showToast("Logged out successfully","success");
        }
    });
}

function settingsAccountSecurity() {
    if (!currentUser) return;
    openSettingsActionModal({
        title:"Account Security",
        description:"Review and manage the sign-in methods connected to your account.",
        options:[
            {value:"email",label:"Email",description:(currentUser.email||"Not added")+" · "+(currentUser.email_confirmed_at?"Verified":"Verification may be required"),icon:"fa-envelope"},
            {value:"phone",label:"Mobile",description:(currentUser.phone||"Not added")+" · "+(currentUser.phone_confirmed_at?"Verified":"Verification may be required"),icon:"fa-mobile-screen"},
            {value:"session",label:"Current Session",description:"View your active StudentKart session",icon:"fa-shield-halved"}
        ],
        onConfirm:async value=>{
            closeModal("settingsActionModal");
            if (value === "email") return settingsEmail();
            if (value === "phone") return settingsMobile();
            if (value === "session") return settingsLoginSessions();
        }
    });
}

function settingsDeleteAccount() {
    openSettingsActionModal({
        title:"Delete Account",
        description:"This permanently deletes your StudentKart account, profile, listings, chats and related account data. This cannot be undone.",
        fields:[{id:"confirm",label:"Type DELETE to continue",placeholder:"DELETE"}],
        confirmText:"Delete Permanently",
        danger:true,
        onConfirm:async values=>{
            if(values.confirm!=="DELETE"){
                showToast("Type DELETE exactly to continue","warning");
                return false;
            }

            if(!currentUser?.id){
                showToast("Please login again before deleting your account","warning");
                return false;
            }

            const userId = currentUser.id;
            const { data, error } = await supabaseClient.functions.invoke("delete-account", {
                body: { confirmation: "DELETE" }
            });

            if(error || !data?.ok){
                console.error("Delete account error:", error, data);
                showToast(data?.error || error?.message || "Could not delete your account", "error");
                return false;
            }

            closeModal("settingsActionModal");
            closeAllModals?.({ fromPopState: true });

            currentUser = null;
            try {
                localStorage.removeItem("studentkart_settings_" + userId);
            } catch (_) {}

            showToast("Your StudentKart account has been permanently deleted", "success");

            setTimeout(() => {
                window.location.hash = "home";
                window.location.reload();
            }, 700);

            return true;
        }
    });
}
async function handleSettingAction(action) {
    if (!currentUser) {
        closeModal("settingsModal");
        openModal("loginModal");
        return;
    }

    if (action === "edit-profile" || action === "college" || action === "profile-photo") {
        closeModal("settingsModal");
        openEditProfile?.();
        return;
    }

    if (action === "email") return settingsEmail();
    if (action === "mobile") return settingsMobile();

    if (["chat-notifications", "wishlist-notifications", "listing-notifications", "buyer-seller-notifications", "sold-notifications"].includes(action)) {
        const map = {
            "chat-notifications": "chat",
            "wishlist-notifications": "wishlist",
            "listing-notifications": "listings",
            "buyer-seller-notifications": "buyerSeller",
            "sold-notifications": "sold"
        };
        return settingsToggle(`notifications.${map[action]}`);
    }

    if (action === "push-notifications") {
        const settings = getStudentKartSettings();
        if (!settings.notifications.push && "Notification" in window) {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                showToast("Browser notification permission was not granted", "warning");
                return;
            }
        }
        return settingsToggle("notifications.push");
    }

    if (action === "profile-visibility") return settingsProfileVisibility();
    if (action === "hide-phone") return settingsToggle("privacy.hidePhone");
    if (action === "hide-email") return settingsToggle("privacy.hideEmail");
    if (action === "blocked-users") return settingsBlockedUsers();

    if (action === "report-problem") return settingsReportProblem();

    if (action === "safety-tips" || action === "safety-about" || action === "about" ||
        action === "terms" || action === "privacy-policy" || action === "contact") {
        const map = {
            "safety-tips": "safety",
            "safety-about": "safety",
            about: "about",
            terms: "terms",
            "privacy-policy": "privacy",
            contact: "contact"
        };
        closeModal("settingsModal");
        document.querySelector(`[data-footer-info="${map[action]}"]`)?.click();
        return;
    }

    if (action === "current-location") return settingsLocationCurrent();
    if (action === "change-location" || action === "state-city-area") return settingsLocationDetails();
    if (action === "nearby-distance") return settingsDistance();
    if (action === "location-permission") return settingsLocationPermission();

    if (action === "theme") return settingsTheme();
    if (action === "language") return settingsLanguage();
    if (action === "vibration") {
        const saved = await settingsToggle("preferences.vibration");
        if (saved && getStudentKartSettings().preferences.vibration && navigator.vibrate) {
            navigator.vibrate(25);
        }
        return saved;
    }

    if (action === "login-sessions") return settingsLoginSessions();
    if (action === "logout-all") return settingsLogoutAll();
    if (action === "account-security") return settingsAccountSecurity();
    if (action === "delete-account") return settingsDeleteAccount();

    if (action === "logout") {
        $("logoutButton")?.click();
        return;
    }
}

const SETTINGS_SECTION_TEMPLATES = {
    account: {
        title: "Account", icon: "fa-user", subtitle: "Manage your profile and account details.",
        html: `
            <button class="settings-row" type="button" data-setting-action="edit-profile"><span><i class="fas fa-pen"></i><b>Edit Profile</b><small>Update your profile details</small></span><i class="fas fa-chevron-right"></i></button>
        `
    },
    notifications: {
        title: "Notifications", icon: "fa-bell", subtitle: "Manage all notification preferences.",
        html: `
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="chat-notifications"><span><i class="fas fa-message"></i><b>New Chat Messages</b><small>Get notified about new chats</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="wishlist-notifications"><span><i class="fa-regular fa-heart"></i><b>Wishlist Updates</b><small>Updates about saved listings</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="listing-notifications"><span><i class="fas fa-box"></i><b>Listing Updates</b><small>Updates about your listings</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="buyer-seller-notifications"><span><i class="fas fa-handshake"></i><b>Interested Buyer/Seller</b><small>Get notified about interest</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="sold-notifications"><span><i class="fas fa-circle-check"></i><b>Sold Listing</b><small>Get notified when listings are sold</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="push-notifications"><span><i class="fas fa-mobile-screen-button"></i><b>Push Notifications</b><small>Allow StudentKart notifications</small></span><span class="settings-switch"><span></span></span></button>`
    },
    privacy: {title:"Privacy & Safety",icon:"fa-shield-halved",subtitle:"Control your privacy and safety preferences.",html:`
        <button class="settings-row" type="button" data-setting-action="profile-visibility"><span><i class="fas fa-eye"></i><b>Who Can See My Profile</b><small>Control profile visibility</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row settings-toggle-row" type="button" data-setting-action="hide-phone"><span><i class="fas fa-phone"></i><b>Hide Phone Number</b><small>Control phone visibility</small></span><span class="settings-switch"><span></span></span></button>
        <button class="settings-row settings-toggle-row" type="button" data-setting-action="hide-email"><span><i class="fas fa-envelope"></i><b>Hide Email</b><small>Control email visibility</small></span><span class="settings-switch"><span></span></span></button>
        <button class="settings-row" type="button" data-setting-action="blocked-users"><span><i class="fas fa-user-slash"></i><b>Blocked Users</b><small>Manage blocked accounts</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="report-problem"><span><i class="fas fa-flag"></i><b>Report a Problem</b><small>Tell us about an issue</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="safety-tips"><span><i class="fas fa-lock"></i><b>Safety Tips</b><small>Stay safe while buying and selling</small></span><i class="fas fa-chevron-right"></i></button>`},
    location:{title:"Location",icon:"fa-location-dot",subtitle:"Manage location and nearby listing preferences.",html:`
        <button class="settings-row" type="button" data-setting-action="current-location"><span><i class="fas fa-location-crosshairs"></i><b>Current Location</b><small>Use your current area</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="change-location"><span><i class="fas fa-map-pin"></i><b>Change Location</b><small>Choose a different location</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="state-city-area"><span><i class="fas fa-map"></i><b>State / City / Area</b><small>Set your preferred area</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="nearby-distance"><span><i class="fas fa-route"></i><b>Nearby Listings Distance</b><small>Choose your search radius</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="location-permission"><span><i class="fas fa-location-dot"></i><b>Location Permission</b><small>Manage location access</small></span><i class="fas fa-chevron-right"></i></button>`},
    preferences:{title:"App Preferences",icon:"fa-palette",subtitle:"Customize how StudentKart looks and behaves.",html:`
        <button class="settings-row" type="button" data-setting-action="theme"><span><i class="fas fa-moon"></i><b>Dark Mode / Light Mode</b><small>Choose your app appearance</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="language"><span><i class="fas fa-language"></i><b>Language</b><small>Choose your preferred language</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row settings-toggle-row" type="button" data-setting-action="vibration"><span><i class="fas fa-mobile-screen-button"></i><b>Vibration / Notification Preferences</b><small>Manage interaction feedback</small></span><span class="settings-switch"><span></span></span></button>`},
    security:{title:"Security",icon:"fa-lock",subtitle:"Manage account sessions and security.",html:`
        <button class="settings-row" type="button" data-setting-action="login-sessions"><span><i class="fas fa-laptop"></i><b>Login Sessions</b><small>View active sessions</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="logout-all"><span><i class="fas fa-right-from-bracket"></i><b>Logout from All Devices</b><small>Sign out of other sessions</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="account-security"><span><i class="fas fa-shield"></i><b>Account Security</b><small>Review account security</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row danger-row" type="button" data-setting-action="delete-account"><span><i class="fas fa-trash-can"></i><b>Delete Account</b><small>Permanently remove your account</small></span><i class="fas fa-chevron-right"></i></button>`},
    about:{title:"About",icon:"fa-circle-info",subtitle:"StudentKart information and support.",html:`
        <button class="settings-row" type="button" data-setting-action="about"><span><i class="fas fa-circle-info"></i><b>About StudentKart</b><small>Learn more about StudentKart</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="terms"><span><i class="fas fa-file-contract"></i><b>Terms & Conditions</b><small>Platform terms</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="privacy-policy"><span><i class="fas fa-user-shield"></i><b>Privacy Policy</b><small>How information is handled</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="safety-about"><span><i class="fas fa-shield-heart"></i><b>Safety</b><small>Safe buying and selling guidance</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="contact"><span><i class="fas fa-headset"></i><b>Contact Us</b><small>Get in touch with StudentKart</small></span><i class="fas fa-chevron-right"></i></button>
        <div class="settings-version"><span>App Version</span><strong>1.0.0</strong></div>`},
    "account-actions":{title:"Account Actions",icon:"fa-door-open",subtitle:"Manage your account session.",html:`
        <button class="settings-row" type="button" data-setting-action="logout"><span><i class="fas fa-right-from-bracket"></i><b>Logout</b><small>Sign out of this account</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row danger-row" type="button" data-setting-action="delete-account"><span><i class="fas fa-trash-can"></i><b>Delete Account</b><small>This action cannot be undone</small></span><i class="fas fa-chevron-right"></i></button>`}
};

document.addEventListener("click", event => {
    const sectionButton = event.target.closest("[data-settings-section]");
    if (!sectionButton) return;
    event.preventDefault();
    event.stopPropagation();
    const key = sectionButton.dataset.settingsSection;
    const config = SETTINGS_SECTION_TEMPLATES[key];
    if (!config) return;
    const title = $("settingsDetailTitle"), subtitle = $("settingsDetailSubtitle"), icon = $("settingsDetailIcon"), content = $("settingsDetailContent");
    if (title) title.textContent = config.title;
    if (subtitle) subtitle.textContent = config.subtitle;
    if (icon) icon.className = "fas " + config.icon;
    if (content) { content.innerHTML = config.html; applyStudentKartLanguage(content); }

    const settingsModal = $("settingsModal");
    const settingsIsOpen = settingsModal && !settingsModal.classList.contains("hidden");

    if (settingsIsOpen &&
        window.history.state?.studentKart === true &&
        window.history.state?.modalId === "settingsModal") {
        // Consume the Settings entry first; once popstate restores the
        // underlying page, open the detail page as a fresh navigation step.
        window.history.back();
        window.setTimeout(() => {
            openModal("settingsDetailModal");
        }, 140);
    } else {
        openModal("settingsDetailModal");
    }
});

document.addEventListener("click", event => {
    const row = event.target.closest("[data-setting-action]");
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    handleSettingAction(row.dataset.settingAction);
});



const footerInfoContent = {
    about: {
        title: "About StudentKart",
        body: `
            <div class="info-intro">StudentKart is a student-focused marketplace designed to make campus buying, selling, renting and discovering useful products easier.</div>
            <div class="info-section">
                <h3><i class="fas fa-store"></i> What is StudentKart?</h3>
                <p>StudentKart brings student-to-student listings into one simple place. Students can browse products, compare listings, save favourites, chat with sellers and publish their own listings.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-bullseye"></i> Our Purpose</h3>
                <p>Our goal is to make useful products and services around student communities easier to discover, while keeping the buying and selling process simple and organized.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-handshake"></i> How StudentKart Works</h3>
                <p>StudentKart connects buyers and sellers. It does not act as the buyer or seller in a transaction. Users are responsible for checking products, sellers, prices and transaction details before making a deal.</p>
            </div>
        `
    },
    how: {
        title: "How It Works",
        body: `
            <div class="how-info-intro">
                <div class="how-info-kicker">SIMPLE PROCESS</div>
                <p>Buying and selling should be simple.</p>
            </div>
            <div class="how-info-steps">
                <div class="how-info-step">
                    <span class="how-info-number">01</span>
                    <div class="how-info-icon"><i class="fas fa-user-plus"></i></div>
                    <div><h3>Create an Account</h3><p>Sign up and create your student profile.</p></div>
                </div>
                <div class="how-info-step">
                    <span class="how-info-number">02</span>
                    <div class="how-info-icon"><i class="fas fa-camera"></i></div>
                    <div><h3>List Your Product</h3><p>Add photos, price, condition and details.</p></div>
                </div>
                <div class="how-info-step">
                    <span class="how-info-number">03</span>
                    <div class="how-info-icon"><i class="fas fa-magnifying-glass"></i></div>
                    <div><h3>Find What You Need</h3><p>Browse products and contact sellers directly.</p></div>
                </div>
                <div class="how-info-step">
                    <span class="how-info-number">04</span>
                    <div class="how-info-icon"><i class="fas fa-handshake"></i></div>
                    <div><h3>Connect &amp; Deal</h3><p>Discuss the product and complete your deal.</p></div>
                </div>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-cart-shopping"></i> Buying on StudentKart</h3>
                <ol class="info-steps">
                    <li>Browse the marketplace or choose a category.</li>
                    <li>Search and filter listings to find what you need.</li>
                    <li>Open a listing and check its price, condition, location and seller details.</li>
                    <li>Contact the seller through StudentKart chat.</li>
                    <li>Discuss the product and agree on the transaction details before paying.</li>
                </ol>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-tag"></i> Selling on StudentKart</h3>
                <ol class="info-steps">
                    <li>Sign in to your StudentKart account.</li>
                    <li>Select <strong>Sell</strong> and add the product details.</li>
                    <li>Add the name, category, price, location, condition, description and photos.</li>
                    <li>Publish your listing.</li>
                    <li>Respond to interested buyers through chat and complete the transaction safely.</li>
                </ol>
            </div>
            <div class="info-note"><i class="fas fa-circle-info"></i><span>Always inspect an item and confirm the final price, payment method and meeting details before completing a transaction.</span></div>
        `
    },
    safety: {
        title: "Safety",
        body: `
            <div class="info-intro">A few simple precautions can help make buying and selling safer on StudentKart.</div>
            <div class="info-section">
                <h3><i class="fas fa-location-dot"></i> Meet Safely</h3>
                <p>Whenever possible, meet in a safe, public and well-known place. If you are inspecting an item, check it carefully before completing the transaction.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-lock"></i> Protect Your Account</h3>
                <ul class="info-list">
                    <li>Never share your password, OTP or verification code.</li>
                    <li>Do not give anyone access to your account.</li>
                    <li>Avoid publishing sensitive personal information in listings, profiles or chats.</li>
                </ul>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-triangle-exclamation"></i> Watch for Suspicious Activity</h3>
                <ul class="info-list">
                    <li>Be careful with requests for advance payments or unusual payment methods.</li>
                    <li>Do not rush into urgent transfers without verifying the details.</li>
                    <li>Be cautious of offers that seem unusually good or inconsistent with the listing.</li>
                </ul>
            </div>
            <div class="info-note warning"><i class="fas fa-flag"></i><span>If a user or listing appears suspicious, stop the transaction and use the available reporting options.</span></div>
        `
    },
    contact: {
        title: "Contact Us",
        body: `
            <div class="info-intro">Need help, found a bug or have a feature suggestion? You can contact the StudentKart team directly.</div>
            <div class="info-contact-card">
                <div class="info-contact-icon"><i class="fas fa-envelope"></i></div>
                <div><span>Email</span><a href="mailto:rathodharish004@gmail.com">rathodharish004@gmail.com</a></div>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-headset"></i> What You Can Contact Us About</h3>
                <ul class="info-list">
                    <li>General feedback and suggestions</li>
                    <li>Bug or technical problem reports</li>
                    <li>Account-related questions</li>
                    <li>Ideas for improving StudentKart</li>
                </ul>
            </div>
            <div class="info-note"><i class="fas fa-circle-info"></i><span>When reporting a problem, include a short description of what happened and the page or feature where you experienced it.</span></div>
        `
    },
    privacy: {
        title: "Privacy Policy",
        body: `
            <div class="info-intro">StudentKart uses information needed to provide account, marketplace and communication features.</div>
            <div class="info-section">
                <h3><i class="fas fa-database"></i> Information Used</h3>
                <p>Account and profile information may be used for features such as authentication, profiles, listings, wishlist, chat and notifications. Information required for a feature may be stored or processed by the services used to operate StudentKart.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-eye"></i> Information You Share</h3>
                <p>StudentKart aims to show only the information needed for marketplace and communication features. Please do not publish sensitive information in your profile, listing descriptions, chat messages or images.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-shield-halved"></i> Keep Your Account Secure</h3>
                <p>Keep your login credentials and OTPs private. If you believe your account or personal information has been exposed, contact StudentKart support.</p>
            </div>
        `
    },
    terms: {
        title: "Terms & Conditions",
        body: `
            <div class="info-intro">By using StudentKart, you agree to use the platform lawfully, honestly and respectfully.</div>
            <div class="info-section">
                <h3><i class="fas fa-user-check"></i> User Responsibilities</h3>
                <ul class="info-list">
                    <li>Provide genuine and accurate information in listings.</li>
                    <li>Use StudentKart only for lawful activities.</li>
                    <li>Do not use the platform for scams, impersonation, harassment or prohibited transactions.</li>
                    <li>Do not intentionally misrepresent a product or service.</li>
                </ul>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-receipt"></i> Transactions</h3>
                <p>Buyers and sellers are responsible for verifying the listing, product condition, identity, price, payment details and other transaction terms before completing a deal.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-users"></i> StudentKart's Role</h3>
                <p>StudentKart provides a platform for users to connect. StudentKart does not become a party to transactions between users. Users are responsible for their own buying and selling decisions.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-shield-halved"></i> Platform Protection</h3>
                <p>StudentKart may restrict or remove content or accounts when necessary to protect users or maintain the platform.</p>
            </div>
        `
    }
}
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-footer-info]").forEach(button => {
        button.addEventListener("click", () => {
            const key = button.dataset.footerInfo;
            const info = footerInfoContent[key];
            if (!info) return;

            const title = document.getElementById("footerInfoTitle");
            const body = document.getElementById("footerInfoBody");
            if (title) title.textContent = info.title;
            if (body) { body.innerHTML = info.body.replace(/\n/g, "<br>"); applyStudentKartLanguage(body); }

            openModal("footerInfoModal");
        });
    });
});

/* FINAL NAVBAR SCROLL BEHAVIOR Hide navbar while scrolling down, reveal it while scrolling up. Bottom floating navigation is intentionally untouched. */
(function initNavbarScrollBehavior() {
    // Keep the main StudentKart navbar visible while scrolling.
    // The bottom quick-navigation bar remains independently fixed.
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;

    navbar.classList.remove("navbar-scroll-hidden");

    window.addEventListener("scroll", () => {
        navbar.classList.remove("navbar-scroll-hidden");
    }, { passive: true });

    window.addEventListener("resize", () => {
        navbar.classList.remove("navbar-scroll-hidden");
    }, { passive: true });
})();


// Start the app after all feature code has been loaded.
initializeStudentKart();
