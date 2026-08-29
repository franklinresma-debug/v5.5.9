<?php
namespace App\Services;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
class MembershipLifecycleService {
    public function recordTransition(object $m, ?string $from, string $to, ?object $actor=null, ?string $reason=null, array $meta=[]): void {
        if (!Schema::hasTable('nurselink_membership_status_history')) return;
        DB::table('nurselink_membership_status_history')->insert([
            'membership_id'=>$m->id,'user_id'=>(string)$m->user_id,'from_status'=>$from,'to_status'=>$to,
            'actor_user_id'=>$actor?(string)$actor->getKey():null,'actor_type'=>$actor?'user':'system','reason'=>$reason,
            'metadata_json'=>$meta?json_encode($meta):null,'created_at'=>now(),'updated_at'=>now(),
        ]);
    }
    public function ensureOnboarding(object $m): bool {
        if (!Schema::hasTable('nurselink_membership_onboarding')) return false;
        if (DB::table('nurselink_membership_onboarding')->where('user_id',$m->user_id)->exists()) return true;
        $cols=Schema::getColumnListing('nurselink_membership_onboarding');
        $row=['user_id'=>$m->user_id,'created_at'=>now(),'updated_at'=>now()];
        if (in_array('membership_id',$cols,true)) $row['membership_id']=$m->id;
        if (in_array('status',$cols,true)) $row['status']='welcome';
        if (in_array('started_at',$cols,true)) $row['started_at']=now();
        DB::table('nurselink_membership_onboarding')->insert($row); return true;
    }
}
