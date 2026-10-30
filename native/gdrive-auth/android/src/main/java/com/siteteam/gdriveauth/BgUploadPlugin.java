package com.siteteam.gdriveauth;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import androidx.work.BackoffPolicy;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * SiteTeam : envoi des photos vers Google Drive en arrière-plan (WorkManager), même application fermée.
 * L'application dépose chaque photo dans une file sur le téléphone (dossier privé de l'appli) avec son chemin Drive ;
 * le Worker l'envoie dès qu'il y a du réseau (ou du Wi-Fi seulement), reprend après coupure ou redémarrage du téléphone,
 * et note le résultat. À la prochaine ouverture, l'application relit les résultats : aucun envoi en double.
 * Aucun secret : le jeton Google est redemandé au système (permission drive.file déjà accordée).
 */
@CapacitorPlugin(name = "BgUpload")
public class BgUploadPlugin extends Plugin {
    static final String WORK = "siteteam-bgupload";

    static File qDir(Context c) { File d = new File(c.getFilesDir(), "bgq"); if (!d.exists()) d.mkdirs(); return d; }
    static File doneDir(Context c) { File d = new File(c.getFilesDir(), "bgq_done"); if (!d.exists()) d.mkdirs(); return d; }
    static String safe(String id) { return (id == null ? "" : id).replaceAll("[^A-Za-z0-9_-]", "_"); }

    /** Dépose une photo dans la file : { id, name, mime, segs:[...], data: base64 } */
    @PluginMethod
    public void enqueue(PluginCall call) {
        final String id = call.getString("id", ""), data = call.getString("data", "");
        if (id.isEmpty() || data.isEmpty()) { call.reject("id / data manquants", "ARG"); return; }
        new Thread(() -> {
            try {
                String sid = safe(id);
                File bin = new File(qDir(getContext()), sid + ".bin"), meta = new File(qDir(getContext()), sid + ".json");
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                try (FileOutputStream o = new FileOutputStream(bin)) { o.write(bytes); }
                JSONObject m = new JSONObject();
                m.put("id", id);
                m.put("name", call.getString("name", "photo.jpg"));
                m.put("mime", call.getString("mime", "image/jpeg"));
                JSArray segs = call.getArray("segs");
                m.put("segs", segs == null ? new JSONArray() : new JSONArray(segs.toString()));
                m.put("at", System.currentTimeMillis());
                // le .json est écrit en dernier : le Worker ne prend que les fichiers complets
                try (FileOutputStream o = new FileOutputStream(meta)) { o.write(m.toString().getBytes("UTF-8")); }
                call.resolve();
            } catch (Exception e) {
                call.reject("Mise en file impossible : " + e.getMessage(), "IO");
            }
        }).start();
    }

    /** Lance (ou relance) l'envoi : { wifiOnly, rootId } */
    @PluginMethod
    public void start(PluginCall call) {
        boolean wifi = call.getBoolean("wifiOnly", false);
        String root = call.getString("rootId", "");
        getContext().getSharedPreferences("bgup", Context.MODE_PRIVATE).edit().putString("root", root == null ? "" : root).putBoolean("wifi", wifi).apply();
        schedule(getContext(), wifi, ExistingWorkPolicy.KEEP);
        call.resolve();
    }

    static void schedule(Context c, boolean wifi, ExistingWorkPolicy pol) {
        Constraints cons = new Constraints.Builder().setRequiredNetworkType(wifi ? NetworkType.UNMETERED : NetworkType.CONNECTED).build();
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(BgUploadWorker.class)
            .setConstraints(cons)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .addTag(WORK)
            .build();
        WorkManager.getInstance(c).enqueueUniqueWork(WORK, pol, req);
    }

    /** État : { pending, pendingIds, done:[{id, driveId?, error?}], running, wifi, lastError } */
    @PluginMethod
    public void status(PluginCall call) {
        new Thread(() -> {
            try {
                JSObject o = new JSObject();
                JSArray pend = new JSArray();
                File[] q = qDir(getContext()).listFiles();
                if (q != null) for (File f : q) if (f.getName().endsWith(".json")) {
                    try { pend.put(new JSONObject(BgUploadWorker.readText(f)).optString("id")); } catch (Exception ignored) { }
                }
                JSArray done = new JSArray();
                File[] d = doneDir(getContext()).listFiles();
                if (d != null) for (File f : d) {
                    try { done.put(new JSONObject(BgUploadWorker.readText(f))); } catch (Exception ignored) { }
                }
                o.put("pending", pend.length());
                o.put("pendingIds", pend);
                o.put("done", done);
                boolean running = false;
                try {
                    List<WorkInfo> L = WorkManager.getInstance(getContext()).getWorkInfosForUniqueWork(WORK).get(3, TimeUnit.SECONDS);
                    for (WorkInfo w : L) if (w.getState() == WorkInfo.State.RUNNING) running = true;
                } catch (Exception ignored) { }
                o.put("running", running);
                android.content.SharedPreferences sp = getContext().getSharedPreferences("bgup", Context.MODE_PRIVATE);
                o.put("wifi", sp.getBoolean("wifi", false));
                o.put("lastError", sp.getString("err", ""));
                call.resolve(o);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage()), "IO"); }
        }).start();
    }

    /** L'application a relu ces résultats : on les efface. { ids:[...] } */
    @PluginMethod
    public void ack(PluginCall call) {
        try {
            JSArray ids = call.getArray("ids");
            if (ids != null) for (Object id : ids.toList()) new File(doneDir(getContext()), safe(String.valueOf(id)) + ".json").delete();
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage()), "IO"); }
    }

    /** Retire des fichiers de la file (l'application les enverra elle-même). { ids:[...] } */
    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            JSArray ids = call.getArray("ids");
            if (ids != null) for (Object id : ids.toList()) {
                String s = safe(String.valueOf(id));
                new File(qDir(getContext()), s + ".json").delete();
                new File(qDir(getContext()), s + ".bin").delete();
            }
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage()), "IO"); }
    }

    /** Autorisation d'afficher la notification de progression (Android 13+). */
    @PluginMethod
    public void notifPermission(PluginCall call) {
        JSObject o = new JSObject();
        if (Build.VERSION.SDK_INT < 33) { o.put("granted", true); call.resolve(o); return; }
        boolean g = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        if (!g && call.getBoolean("ask", false) && getActivity() != null) ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7311);
        o.put("granted", g);
        call.resolve(o);
    }

    /** Ouvre l'écran « Optimisation de la batterie » (Huawei, Xiaomi… arrêtent sinon l'envoi en arrière-plan). */
    @PluginMethod
    public void batterySettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception ignored) { }
        }
        call.resolve();
    }
}
