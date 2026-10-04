/* Banjara Connect — shared Supabase client */
(function(){
  "use strict";
  var url="https://yymzfjfkmsrymqhpnfqz.supabase.co";
  var key="sb_publishable_tEePI-aSGDkt_2S6oiEfPw_Hy_mEXkw";
  if(window.supabase && !window.supabaseClient){
    window.supabaseClient=window.supabase.createClient(url,key);
  }
})();
