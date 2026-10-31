package com.siteteam.gdriveauth;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;

/**
 * SiteTeam : accès à Google Drive sans Apps Script.
 * Utilise l'API d'autorisation Google (Identity.getAuthorizationClient) : l'utilisateur choisit son compte
 * et accepte une seule fois la permission « drive.file » (seulement les fichiers créés par SiteTeam).
 * Aucun secret dans l'application : Google reconnaît l'appli par son nom de package + empreinte SHA-1.
 */
@CapacitorPlugin(name = "GDriveAuth")
public class GDriveAuthPlugin extends Plugin {
    private static final String DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";
    private ActivityResultLauncher<IntentSenderRequest> consent;
    private PluginCall pending;

    @Override
    public void load() {
        consent = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), this::onConsent);
        final Context ctx = getContext();
        // v1.0.51 : au démarrage, AVANT la page web — on retire côté Android les anciens rappels programmés avec « on »
        // (v1.0.47 : rappel 17 h, robot emploi) qui pouvaient se redéclencher en boucle et bloquer l'application
        purgeLoopNotifs(ctx);
        // diagnostic : plantage Java ou arrêt du moteur web enregistrés pour le rapport du mode secours
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            try { StringWriter sw = new StringWriter(); e.printStackTrace(new PrintWriter(sw)); String st = sw.toString();
                saveCrash(ctx, "java " + t.getName() + " : " + (st.length() > 3000 ? st.substring(0, 3000) : st)); } catch (Throwable ignored) { }
            if (prev != null) prev.uncaughtException(t, e);
        });
        try {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    String why = "moteur web arrêté";
                    try { if (Build.VERSION.SDK_INT >= 26) why += detail.didCrash() ? " (plantage)" : " (mémoire insuffisante : Android l'a fermé)"; } catch (Throwable ignored) { }
                    saveCrash(ctx, why);
                    return false;
                }
            });
        } catch (Throwable ignored) { }
    }

    private static void saveCrash(Context ctx, String msg) {
        try { ctx.getSharedPreferences("st_crash", Context.MODE_PRIVATE).edit().putString("last", new java.util.Date().toString() + " — " + msg).commit(); } catch (Throwable ignored) { }
    }

    static void purgeLoopNotifs(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            ComponentName cn = new ComponentName(ctx.getPackageName(), "com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher");
            int fl = PendingIntent.FLAG_NO_CREATE | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            for (int id : new int[] { 1999000301, 1999000101 }) {
                Intent i = new Intent(); i.setComponent(cn);
                PendingIntent pi = PendingIntent.getBroadcast(ctx, id, i, fl);
                if (pi != null && am != null) { am.cancel(pi); pi.cancel(); }
                if (nm != null) nm.cancel(id);
            }
            SharedPreferences sp = ctx.getSharedPreferences("NOTIFICATION_STORE", Context.MODE_PRIVATE);
            sp.edit().remove("1999000301").remove("1999000101").commit();
        } catch (Throwable ignored) { }
    }

    @PluginMethod
    public void lastCrash(PluginCall call) {
        SharedPreferences sp = getContext().getSharedPreferences("st_crash", Context.MODE_PRIVATE);
        JSObject r = new JSObject(); r.put("last", sp.getString("last", ""));
        if (call.getBoolean("clear", false)) sp.edit().remove("last").apply();
        call.resolve(r);
    }

    private List<Scope> scopes(PluginCall call) {
        List<Scope> list = new ArrayList<>();
        JSArray arr = call.getArray("scopes");
        try {
            if (arr != null) for (Object s : arr.toList()) list.add(new Scope(String.valueOf(s)));
        } catch (Exception ignored) { }
        if (list.isEmpty()) list.add(new Scope(DRIVE_FILE));
        return list;
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        final boolean interactive = call.getBoolean("interactive", true);
        AuthorizationRequest req = AuthorizationRequest.builder().setRequestedScopes(scopes(call)).build();
        Identity.getAuthorizationClient(getActivity()).authorize(req)
            .addOnSuccessListener(res -> {
                if (res.hasResolution()) {
                    if (!interactive) { call.reject("Autorisation Google nécessaire", "NEED_CONSENT"); return; }
                    PendingIntent pi = res.getPendingIntent();
                    if (pi == null) { call.reject("Autorisation Google impossible", "NO_INTENT"); return; }
                    if (pending != null) pending.reject("Remplacée par une nouvelle demande", "REPLACED");
                    pending = call;
                    try {
                        consent.launch(new IntentSenderRequest.Builder(pi.getIntentSender()).build());
                    } catch (Exception e) {
                        pending = null;
                        call.reject("Fenêtre Google impossible : " + e.getMessage(), "LAUNCH");
                    }
                } else {
                    resolveWith(call, res);
                }
            })
            .addOnFailureListener(e -> {
                String code = (e instanceof ApiException) ? String.valueOf(((ApiException) e).getStatusCode()) : "ERR";
                call.reject(String.valueOf(e.getMessage()), code);
            });
    }

    private void onConsent(ActivityResult r) {
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) { call.reject("Autorisation annulée", "CANCELED"); return; }
        try {
            AuthorizationResult res = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(r.getData());
            resolveWith(call, res);
        } catch (ApiException e) {
            call.reject(String.valueOf(e.getMessage()), String.valueOf(e.getStatusCode()));
        }
    }

    private void resolveWith(PluginCall call, AuthorizationResult res) {
        String tok = res.getAccessToken();
        if (tok == null || tok.isEmpty()) { call.reject("Pas de jeton Google", "NO_TOKEN"); return; }
        JSObject o = new JSObject();
        o.put("accessToken", tok);
        JSArray granted = new JSArray();
        for (String s : res.getGrantedScopes()) granted.put(s);
        o.put("scopes", granted);
        call.resolve(o);
    }

    /** Jeton refusé par Google (expiré / révoqué) : on l'oublie pour en obtenir un nouveau. */
    @PluginMethod
    public void clearToken(PluginCall call) {
        final String tok = call.getString("token", "");
        new Thread(() -> {
            try {
                if (!tok.isEmpty()) GoogleAuthUtil.clearToken(getContext(), tok);
                call.resolve();
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), "CLEAR");
            }
        }).start();
    }
}
