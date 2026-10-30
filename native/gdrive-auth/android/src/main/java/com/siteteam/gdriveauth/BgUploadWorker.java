package com.siteteam.gdriveauth;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.ForegroundInfo;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Tasks;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** Envoi des photos de la file vers Google Drive (voir BgUploadPlugin). */
public class BgUploadWorker extends Worker {
    private static final String API = "https://www.googleapis.com/drive/v3/files";
    private static final String UP = "https://www.googleapis.com/upload/drive/v3/files";
    private static final String FOLDER = "application/vnd.google-apps.folder";
    private static final String CH = "siteteam_upload";
    private static final int NID = 7310;
    private String tok;

    public BgUploadWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    static String readText(File f) throws Exception {
        try (InputStream in = new FileInputStream(f)) { return new String(readAll(in), "UTF-8"); }
    }
    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        return b.toByteArray();
    }

    /** Erreur définitive pour ce fichier (on ne réessaie pas) */
    static class Fatal extends Exception { Fatal(String m) { super(m); } }
    /** Autorisation Google à renouveler dans l'application */
    static class NeedConsent extends Exception { NeedConsent() { super("Autorisation Google à renouveler"); } }

    private SharedPreferences sp() { return getApplicationContext().getSharedPreferences("bgup", Context.MODE_PRIVATE); }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        int sent = 0, total = 0;
        try {
            for (int round = 0; round < 50; round++) {
                List<File> q = queue();
                if (q.isEmpty()) break;
                total = Math.max(total, sent + q.size());
                for (File meta : q) {
                    if (isStopped()) return Result.retry();
                    progress(sent, total);
                    JSONObject m = new JSONObject(readText(meta));
                    String sid = meta.getName().replace(".json", "");
                    File bin = new File(meta.getParentFile(), sid + ".bin");
                    JSONObject res = new JSONObject();
                    res.put("id", m.optString("id"));
                    if (!bin.exists()) { res.put("error", "fichier absent"); }
                    else {
                        try { res.put("driveId", upload(m, bin)); sent++; }
                        catch (Fatal e) { res.put("error", e.getMessage()); }
                    }
                    try (FileOutputStream o = new FileOutputStream(new File(BgUploadPlugin.doneDir(c), sid + ".json"))) { o.write(res.toString().getBytes("UTF-8")); }
                    meta.delete(); bin.delete();
                }
            }
            sp().edit().putString("err", "").apply();
            finish(sent);
            return Result.success();
        } catch (NeedConsent e) {
            sp().edit().putString("err", e.getMessage()).apply();
            cancelNotif();
            return Result.failure();   // l'application relancera après reconnexion
        } catch (Exception e) {
            sp().edit().putString("err", String.valueOf(e.getMessage())).apply();
            cancelNotif();
            return Result.retry();     // réseau coupé, Drive indisponible… : WorkManager réessaie plus tard
        }
    }

    private List<File> queue() {
        File[] L = BgUploadPlugin.qDir(getApplicationContext()).listFiles();
        List<File> out = new ArrayList<>();
        if (L != null) { Arrays.sort(L); for (File f : L) if (f.getName().endsWith(".json")) out.add(f); }
        return out;
    }

    // ---------- jeton Google (permission drive.file déjà accordée dans l'application) ----------
    private String token(boolean fresh) throws Exception {
        if (tok != null && !fresh) return tok;
        if (tok != null) { try { GoogleAuthUtil.clearToken(getApplicationContext(), tok); } catch (Exception ignored) { } }
        AuthorizationRequest req = AuthorizationRequest.builder().setRequestedScopes(Collections.singletonList(new Scope("https://www.googleapis.com/auth/drive.file"))).build();
        AuthorizationResult r = Tasks.await(Identity.getAuthorizationClient(getApplicationContext()).authorize(req), 60, TimeUnit.SECONDS);
        if (r.hasResolution() || r.getAccessToken() == null) throw new NeedConsent();
        tok = r.getAccessToken();
        return tok;
    }

    private static class Resp { int code; String body; String location; }

    private Resp http(String method, String url, String ctype, byte[] body, File file, String extraType, long len) throws Exception {
        for (int n = 0; n < 2; n++) {
            HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
            h.setConnectTimeout(30000); h.setReadTimeout(120000);
            h.setRequestMethod(method);
            h.setRequestProperty("Authorization", "Bearer " + token(n > 0));
            if (extraType != null) { h.setRequestProperty("X-Upload-Content-Type", extraType); h.setRequestProperty("X-Upload-Content-Length", String.valueOf(len)); }
            if (body != null || file != null) {
                h.setDoOutput(true);
                if (ctype != null) h.setRequestProperty("Content-Type", ctype);
                long size = file != null ? file.length() : body.length;
                h.setFixedLengthStreamingMode(size);
                try (OutputStream o = h.getOutputStream()) {
                    if (file != null) { try (InputStream in = new FileInputStream(file)) { byte[] buf = new byte[65536]; int k; while ((k = in.read(buf)) > 0) { o.write(buf, 0, k); if (isStopped()) throw new Exception("arrêté"); } } }
                    else o.write(body);
                }
            }
            Resp r = new Resp();
            r.code = h.getResponseCode();
            r.location = h.getHeaderField("Location");
            InputStream in = r.code >= 400 ? h.getErrorStream() : h.getInputStream();
            r.body = in == null ? "" : new String(readAll(in), "UTF-8");
            h.disconnect();
            if (r.code == 401 && n == 0) continue;   // jeton expiré : un nouveau, et on recommence
            return r;
        }
        throw new NeedConsent();
    }

    private String q(String s) { return s.replace("\\", "\\\\").replace("'", "\\'"); }

    private String findOrCreate(String parent, String name) throws Exception {
        String key = "d:" + parent + "/" + name;
        String id = sp().getString(key, null);
        if (id != null) return id;
        String query = "name='" + q(name) + "' and '" + parent + "' in parents and mimeType='" + FOLDER + "' and trashed=false";
        Resp r = http("GET", API + "?q=" + URLEncoder.encode(query, "UTF-8") + "&fields=files(id)&orderBy=createdTime&spaces=drive", null, null, null, null, 0);
        if (r.code >= 500 || r.code == 429) throw new Exception("Drive " + r.code);
        if (r.code >= 400) throw new Fatal("Drive " + r.code);
        JSONArray f = new JSONObject(r.body).optJSONArray("files");
        if (f != null && f.length() > 0) id = f.getJSONObject(0).getString("id");
        else {
            JSONObject meta = new JSONObject(); meta.put("name", name); meta.put("mimeType", FOLDER); meta.put("parents", new JSONArray().put(parent));
            Resp c = http("POST", API + "?fields=id", "application/json; charset=UTF-8", meta.toString().getBytes("UTF-8"), null, null, 0);
            if (c.code >= 500 || c.code == 429) throw new Exception("Drive " + c.code);
            if (c.code >= 400) throw new Fatal("Drive " + c.code);
            id = new JSONObject(c.body).getString("id");
        }
        sp().edit().putString(key, id).apply();
        return id;
    }

    private String rootId() throws Exception {
        String id = sp().getString("root", "");
        if (id != null && !id.isEmpty()) return id;
        id = findOrCreate("root", "SiteTeam");
        sp().edit().putString("root", id).apply();
        return id;
    }

    private String folderFor(JSONArray segs) throws Exception {
        String f = rootId();
        for (int i = 0; i < segs.length(); i++) f = findOrCreate(f, segs.getString(i));
        return f;
    }

    private void forgetFolders() {
        SharedPreferences.Editor e = sp().edit();
        for (String k : sp().getAll().keySet()) if (k.startsWith("d:")) e.remove(k);
        e.apply();
    }

    /** Envoi « reprise possible » : demande d'une adresse d'envoi, puis le fichier en un flux. */
    private String upload(JSONObject m, File bin) throws Exception {
        for (int attempt = 0; attempt < 2; attempt++) {
            String folder = folderFor(m.getJSONArray("segs"));
            String mime = m.optString("mime", "image/jpeg");
            JSONObject meta = new JSONObject(); meta.put("name", m.optString("name", "photo.jpg")); meta.put("mimeType", mime); meta.put("parents", new JSONArray().put(folder));
            Resp s = http("POST", UP + "?uploadType=resumable&fields=id", "application/json; charset=UTF-8", meta.toString().getBytes("UTF-8"), null, mime, bin.length());
            if (s.code == 404 && attempt == 0) { forgetFolders(); sp().edit().putString("root", "").apply(); continue; }   // dossier supprimé dans Drive : on le recrée
            if (s.code >= 500 || s.code == 429 || (s.code == 403 && s.body.contains("ateLimit"))) throw new Exception("Drive " + s.code);
            if (s.code >= 400 || s.location == null) throw new Fatal("Drive " + s.code);
            Resp r = http("PUT", s.location, mime, null, bin, null, 0);
            if (r.code >= 500 || r.code == 429) throw new Exception("Drive " + r.code);
            if (r.code >= 400) throw new Fatal("Drive " + r.code);
            return new JSONObject(r.body).getString("id");
        }
        throw new Fatal("Dossier Drive introuvable");
    }

    // ---------- notification ----------
    private void channel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getApplicationContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CH) == null) nm.createNotificationChannel(new NotificationChannel(CH, "Envoi vers Google Drive", NotificationManager.IMPORTANCE_LOW));
        }
    }
    private void progress(int sent, int total) {
        channel();
        android.app.Notification n = new NotificationCompat.Builder(getApplicationContext(), CH)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle("SiteTeam · envoi vers Google Drive")
            .setContentText(sent + " / " + total + " photo(s)")
            .setProgress(total, sent, false).setOngoing(true).setOnlyAlertOnce(true).build();
        try {
            if (Build.VERSION.SDK_INT >= 29) setForegroundAsync(new ForegroundInfo(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC));
            else setForegroundAsync(new ForegroundInfo(NID, n));
        } catch (Exception e) {
            try { NotificationManagerCompat.from(getApplicationContext()).notify(NID, n); } catch (SecurityException ignored) { }
        }
    }
    private void cancelNotif() { try { NotificationManagerCompat.from(getApplicationContext()).cancel(NID); } catch (Exception ignored) { } }
    private void finish(int sent) {
        cancelNotif();
        if (sent <= 0) return;
        channel();
        try {
            NotificationManagerCompat.from(getApplicationContext()).notify(NID + 1, new NotificationCompat.Builder(getApplicationContext(), CH)
                .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setContentTitle("SiteTeam")
                .setContentText(sent + " photo(s) envoyée(s) dans Google Drive ✓")
                .setAutoCancel(true).build());
        } catch (SecurityException ignored) { }
    }
}
