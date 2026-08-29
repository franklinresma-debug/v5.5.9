<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Services\MembershipLifecycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
class SmartRegistrationController extends Controller {
    private array $required=['full_name','email','phone','country','profession'];
    public function show(Request $r): JsonResponse { return response()->json(['data'=>$this->state($r->user())]); }
    public function save(Request $r): JsonResponse {
        $u=$r->user(); $m=$this->membership($u); abort_if(!in_array(strtolower((string)$m->status),['draft','needs_information'],true),409,'Application is locked while under review.');
        $profile=$r->validate(['profile'=>'required|array'])['profile']; $old=DB::table('nurselink_smart_registration_profiles')->where('user_id',$u->getKey())->first();
        $data=$old?json_decode($old->profile_json?:'{}',true):[]; $prov=$old?json_decode($old->provenance_json?:'{}',true):[];
        foreach($profile as $k=>$v){ if(($data[$k]??null)!==$v)$prov[$k]=['source'=>'applicant_confirmed','confidence'=>1]; $data[$k]=$v; }
        DB::table('nurselink_smart_registration_profiles')->updateOrInsert(['user_id'=>(string)$u->getKey()],[
            'profile_json'=>json_encode($data),'provenance_json'=>json_encode($prov),'missing_fields_json'=>json_encode($this->missing($data)),
            'status'=>strtolower((string)$m->status),'created_at'=>now(),'updated_at'=>now(),
        ]); return response()->json(['data'=>$this->state($u)]);
    }
    public function upload(Request $r): JsonResponse {
        $u=$r->user(); $m=$this->membership($u); abort_if(!in_array(strtolower((string)$m->status),['draft','needs_information'],true),409,'Application is locked while under review.');
        $r->validate(['document'=>'required|file|max:15360','document_type'=>'nullable|string|max:80']); $f=$r->file('document'); $type=$r->input('document_type','supporting_document');
        $version=(int)DB::table('nurselink_smart_registration_documents')->where('user_id',$u->getKey())->where('document_type',$type)->max('version')+1;
        DB::table('nurselink_smart_registration_documents')->where('user_id',$u->getKey())->where('document_type',$type)->update(['active'=>false,'updated_at'=>now()]);
        $path=$f->storeAs('nurselink/smart-registration/'.(string)$u->getKey(),Str::uuid().'.'.strtolower($f->getClientOriginalExtension()),'local');
        [$text,$fields,$conf]=$this->extract($f->getRealPath(),strtolower($f->getClientOriginalExtension()));
        $id=DB::table('nurselink_smart_registration_documents')->insertGetId(['user_id'=>(string)$u->getKey(),'document_type'=>$type,'original_name'=>$f->getClientOriginalName(),'storage_path'=>$path,'mime_type'=>$f->getMimeType(),'size_bytes'=>$f->getSize(),'sha256'=>hash_file('sha256',$f->getRealPath()),'extracted_text'=>$text,'extracted_json'=>json_encode($fields),'confidence_json'=>json_encode($conf),'version'=>$version,'active'=>true,'created_at'=>now(),'updated_at'=>now()]);
        $this->merge($u,$fields,$conf,$id,$type); return response()->json(['data'=>$this->state($u)],201);
    }
    public function document(Request $r,int $id){ $d=DB::table('nurselink_smart_registration_documents')->where('id',$id)->where('user_id',$r->user()->getKey())->first(); abort_unless($d,404); abort_unless(Storage::disk('local')->exists($d->storage_path),404); return Storage::disk('local')->download($d->storage_path,$d->original_name); }
    public function submit(Request $r,MembershipLifecycleService $life): JsonResponse { return $this->commit($r,$life,false); }
    public function resubmit(Request $r,MembershipLifecycleService $life): JsonResponse { return $this->commit($r,$life,true); }
    private function commit(Request $r,MembershipLifecycleService $life,bool $again): JsonResponse {
        $u=$r->user(); $m=$this->membership($u); $from=strtolower((string)$m->status); abort_if($from!==($again?'needs_information':'draft'),409,'Application cannot be submitted from its current status.');
        $state=$this->state($u); abort_if(count($state['missing_fields'])>0,422,'Complete missing required information first.'); abort_if(count($state['documents'])<1,422,'Upload at least one supporting document.');
        DB::transaction(function()use($u,$m,$from,$again,$life){ DB::table('nurselink_memberships')->where('id',$m->id)->update(['status'=>'submitted','updated_at'=>now()]); DB::table('nurselink_smart_registration_profiles')->where('user_id',$u->getKey())->update(['status'=>'submitted',$again?'resubmitted_at':'submitted_at'=>now(),'revision'=>DB::raw('revision + 1'),'updated_at'=>now()]); $now=DB::table('nurselink_memberships')->where('id',$m->id)->first(); $life->recordTransition($now,$from,'submitted',$u,$again?'Applicant resubmitted requested information':'Applicant submitted Smart Registration',['smart_registration'=>true]); });
        return response()->json(['data'=>$this->state($u)]);
    }
    private function membership(object $u): object { $m=DB::table('nurselink_memberships')->where('user_id',$u->getKey())->first(); if($m)return $m; $id=DB::table('nurselink_memberships')->insertGetId(['user_id'=>$u->getKey(),'status'=>'draft','created_at'=>now(),'updated_at'=>now()]); return DB::table('nurselink_memberships')->where('id',$id)->first(); }
    private function state(object $u): array { $m=$this->membership($u); $p=DB::table('nurselink_smart_registration_profiles')->where('user_id',$u->getKey())->first(); $d=$p?json_decode($p->profile_json?:'{}',true):[]; if(empty($d['email'])&&!empty($u->email))$d['email']=$u->email; if(empty($d['full_name'])&&!empty($u->name))$d['full_name']=$u->name; $docs=DB::table('nurselink_smart_registration_documents')->where('user_id',$u->getKey())->where('active',true)->orderByDesc('created_at')->get()->map(fn($x)=>['id'=>$x->id,'document_type'=>$x->document_type,'name'=>$x->original_name,'version'=>$x->version,'created_at'=>$x->created_at]); return ['membership_id'=>$m->id,'status'=>$m->status,'reviewer_notes'=>$m->reviewer_notes??null,'profile'=>$d,'provenance'=>$p?json_decode($p->provenance_json?:'{}',true):[],'missing_fields'=>$this->missing($d),'documents'=>$docs]; }
    private function missing(array $d): array { return array_values(array_filter($this->required,fn($k)=>trim((string)($d[$k]??''))==='')); }
    private function merge(object $u,array $f,array $c,int $id,string $type): void { $p=DB::table('nurselink_smart_registration_profiles')->where('user_id',$u->getKey())->first(); $d=$p?json_decode($p->profile_json?:'{}',true):[]; $pr=$p?json_decode($p->provenance_json?:'{}',true):[]; foreach($f as $k=>$v)if(trim((string)($d[$k]??''))===''){ $d[$k]=$v; $pr[$k]=['source'=>'document','document_id'=>$id,'document_type'=>$type,'confidence'=>$c[$k]??.6]; } DB::table('nurselink_smart_registration_profiles')->updateOrInsert(['user_id'=>(string)$u->getKey()],['profile_json'=>json_encode($d),'provenance_json'=>json_encode($pr),'missing_fields_json'=>json_encode($this->missing($d)),'status'=>'draft','created_at'=>now(),'updated_at'=>now()]); }
    private function extract(string $path,string $ext): array { $text=''; if($ext==='pdf'&&$this->cmd('pdftotext')){ $tmp=tempnam(sys_get_temp_dir(),'nl'); @shell_exec('pdftotext '.escapeshellarg($path).' '.escapeshellarg($tmp).' 2>/dev/null'); $text=@file_get_contents($tmp)?:''; @unlink($tmp); } elseif(in_array($ext,['jpg','jpeg','png','webp'],true)&&$this->cmd('tesseract')) $text=(string)@shell_exec('tesseract '.escapeshellarg($path).' stdout 2>/dev/null'); elseif($ext==='docx'&&class_exists('ZipArchive')){ $z=new \ZipArchive(); if($z->open($path)===true){ $x=$z->getFromName('word/document.xml'); $text=html_entity_decode(strip_tags(str_replace(['</w:p>','</w:tr>'],["\n","\n"],$x?:''))); $z->close(); } } $f=[];$c=[]; if(preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i',$text,$m)){ $f['email']=$m[0];$c['email']=.95;} if(preg_match('/(?:\+?\d[\d\s().-]{7,}\d)/',$text,$m)){ $f['phone']=trim($m[0]);$c['phone']=.75;} if(preg_match('/(?:PRC|LICENSE|LICENCE)\s*(?:NO\.?|NUMBER|#)?\s*[:\-]?\s*([A-Z0-9\-]{5,30})/i',$text,$m)){ $f['license_number']=$m[1];$c['license_number']=.8;} return [mb_substr($text,0,100000),$f,$c]; }
    private function cmd(string $c): bool { $o=[];$rc=1; @exec('command -v '.escapeshellarg($c).' 2>/dev/null',$o,$rc); return $rc===0&&count($o)>0; }
}
