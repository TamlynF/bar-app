"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "../../../../components/ui/sheet";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  LayoutGrid,
  Hash,
  Target
} from "lucide-react";
import { saveQuizCategoryAction, deleteQuizCategoryAction, QuizCategoryConfig } from "./actions";
import { useConfirm } from "@/components/ui/confirm-dialog";

export default function QuizCategoriesClient({ 
  initialConfigs = [] 
}: { 
  initialConfigs: QuizCategoryConfig[] 
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<QuizCategoryConfig | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenEdit = (config: QuizCategoryConfig) => {
    setEditingConfig(config);
    setIsSheetOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingConfig(null);
    setIsSheetOpen(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Delete category",
      description: "Delete this quiz category configuration? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteQuizCategoryAction(id);
      if (result?.error) alert(result.error);
    });
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveQuizCategoryAction(formData);
      if (result?.error) {
        alert(result.error);
      } else {
        setIsSheetOpen(false);
      }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between pb-4 border-b border-[#E6DFC8]">
        <div>
          <h3 className="text-lg font-medium">Quiz Round Rules</h3>
          <p className="text-sm text-muted-foreground">
            Configure default question counts and points for each category.
          </p>
        </div>
      </div>

      <div className="mt-6 border rounded-2xl overflow-hidden bg-card shadow-sm border-[#E6DFC8]">
        <div className="p-3 border-b border-[#E6DFC8] bg-muted/5 flex items-center justify-between">
           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Configured Categories</span>
           <Button onClick={handleOpenAdd} size="sm" className="font-bold uppercase tracking-wider text-[10px] h-8 px-3 rounded-xl">
             <Plus className="w-3.5 h-3.5 mr-1.5" />
             New
           </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-muted/30 border-b border-[#E6DFC8]">
              <tr>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Category Name</th>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Questions</th>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Points/Q</th>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {initialConfigs.map((config) => (
                <tr key={config.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <LayoutGrid className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-foreground">{config.category_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground font-mono font-bold text-xs">
                      {config.question_count}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FDCC4B]/20 text-[#26300D] font-mono font-bold text-xs">
                      {config.points_per_question}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleOpenEdit(config)}>
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => handleDelete(config.id!)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {initialConfigs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-muted-foreground italic">
                    No category configurations found. Click &quot;New&quot; to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md h-full flex flex-col p-0 gap-0 border-l border-border/50">
          <SheetHeader className="px-6 pt-8 pb-6 text-left border-b border-border/40 bg-card">
            <SheetTitle className="text-2xl font-black uppercase tracking-tight">
              {editingConfig ? "Edit Category" : "New Category Rules"}
            </SheetTitle>
            <SheetDescription className="text-sm font-medium">
              Set the defaults for round generation and scoring.
            </SheetDescription>
          </SheetHeader>
          
          <form action={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-background/30">
            {editingConfig?.id && <input type="hidden" name="id" value={editingConfig.id} />}
            
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
              <div className="space-y-2 text-left">
                <Label htmlFor="category_name" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Category Name</Label>
                <Input 
                  id="category_name" 
                  name="category_name" 
                  placeholder="e.g. Movies, 80s Music..." 
                  defaultValue={editingConfig?.category_name || ""} 
                  required
                  className="h-12 rounded-xl text-base shadow-sm border-border bg-white"
                />
              </div>

              
                <div className="space-y-2 text-left">
                  <Label htmlFor="question_count" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Questions per Round</Label>
                  <div className="relative">
                    <Input 
                      id="question_count" 
                      name="question_count" 
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={editingConfig?.question_count || "10"} 
                      className="h-12 rounded-xl pl-10 shadow-sm border-border bg-white"
                    />
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <Label htmlFor="points_per_question" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Points per Correct Answer</Label>
                  <div className="relative">
                    <Input 
                      id="points_per_question" 
                      name="points_per_question" 
                      type="number"
                      min={1}
                      defaultValue={editingConfig?.points_per_question || "1"} 
                      className="h-12 rounded-xl pl-10 shadow-sm border-border bg-white"
                    />
                    <Target className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            
            
            <SheetFooter className="px-6 py-6 border-t border-border/40 bg-card/80 backdrop-blur pb-10 sm:pb-6">
              <div className="flex gap-3 w-full">
                <Button type="button" variant="outline" onClick={() => setIsSheetOpen(false)} disabled={isPending} className="flex-1 h-12 rounded-xl font-bold uppercase tracking-wider text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg">
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingConfig ? "Edit" : "Save"}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      {ConfirmDialogUI}
    </div>
  );
}