<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller; use Illuminate\Http\JsonResponse; use Illuminate\Http\Request; use Illuminate\Support\Facades\DB; use Illuminate\Support\Facades\Storage;
class AdminSmartRegistrationController extends Controller {
    public function show(Request $r,int $membershipId): JsonResponse { $m=DB::table('nurselink_memberships')->where('id',$membershipId)->first(); abort_unless($m,404); $p=DB::table('nurselink_smart_registration_profiles')->where('user_id',$m->user_id)->first(); $docs=DB::table('nurselink_smart_registration_documents')->where('user_id',$m->user_id)->where('active',true)->orderByDesc('created_at')->get()->map(fn($d)=>['id'=>$d->id,'document_type'=>$d->document_type,'name'=>$d->original_name,'version'=>$d->version,'created_at'=>$d->created_at]); return response()->json(['data'=>['membership'=>$m,'profile'=>$p?json_decode($p->profile_json?:'{}',true):[],'provenance'=>$p?json_decode($p->provenance_json?:'{}',true):[],'documents'=>$docs]]); }
    public function document(Request $r,int $id){ $d=DB::table('nurselink_smart_registration_documents')->where('id',$id)->first(); abort_unless($d,404); abort_unless(Storage::disk('local')->exists($d->storage_path),404); return Storage::disk('local')->download($d->storage_path,$d->original_name); }
}
