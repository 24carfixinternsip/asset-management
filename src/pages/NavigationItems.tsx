import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  DEFAULT_NAV_GROUPS,
  NAV_ICON_OPTIONS,
  ROLE_OPTIONS,
  getNavIcon,
  NavGroupConfig,
  NavRole,
} from "@/lib/navigation";
import { normalizeNavigationConfig, useNavigationConfig } from "@/hooks/useNavigationConfig";
import { GripVertical, LayoutGrid, ListTree, Plus, Save, Trash2 } from "lucide-react";

const EMPTY_GROUP_FORM = {
  label: "",
  icon: "layout-grid",
  order_index: 0,
  is_active: true,
};

const EMPTY_ITEM_FORM = {
  label: "",
  path: "",
  icon: "layout-dashboard",
  group_id: "",
  order_index: 0,
  is_visible: true,
  roles: ["admin", "viewer"] as NavRole[],
};

type DragState =
  | { type: "group"; groupId: string }
  | { type: "item"; groupId: string; itemId: string }
  | null;

type DeleteTarget = { type: "group" | "item"; id: string; label: string } | null;
type SelectedTarget = { type: "group" | "item"; id: string } | null;

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function NavigationItems() {
  const queryClient = useQueryClient();
  const { data: navData, isLoading } = useNavigationConfig();

  const [groups, setGroups] = useState<NavGroupConfig[]>([]);
  const [dragState, setDragState] = useState<DragState>(null);
  const [selected, setSelected] = useState<SelectedTarget>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP_FORM);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);

  const normalizedGroups = useMemo(() => normalizeNavigationConfig(navData), [navData]);

  useEffect(() => {
    setGroups(normalizedGroups);
  }, [normalizedGroups]);

  const selectedGroup = useMemo(() => {
    if (!selected || selected.type !== "group") return null;
    return groups.find((group) => group.id === selected.id) ?? null;
  }, [selected, groups]);

  const selectedItem = useMemo(() => {
    if (!selected || selected.type !== "item") return null;
    for (const group of groups) {
      const item = group.items.find((entry) => entry.id === selected.id);
      if (item) return { ...item, groupId: group.id };
    }
    return null;
  }, [selected, groups]);

  useEffect(() => {
    if (selectedGroup) {
      setGroupForm({
        label: selectedGroup.label,
        icon: selectedGroup.icon ?? "layout-grid",
        order_index: selectedGroup.order_index,
        is_active: selectedGroup.is_active,
      });
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedItem) {
      setItemForm({
        label: selectedItem.label,
        path: selectedItem.path,
        icon: selectedItem.icon ?? "layout-dashboard",
        group_id: selectedItem.groupId,
        order_index: selectedItem.order_index,
        is_visible: selectedItem.is_visible,
        roles: selectedItem.roles,
      });
    }
  }, [selectedItem]);

  const handleSeedDefaults = async () => {
    try {
      const { data: createdGroups, error } = await supabase
        .from("navigation_groups")
        .insert(
          DEFAULT_NAV_GROUPS.map((group) => ({
            label: group.label,
            icon: group.icon,
            order_index: group.order_index,
            is_active: group.is_active,
            is_core: group.is_core ?? false,
          })),
        )
        .select("*");

      if (error) throw error;

      const groupMap = new Map(createdGroups.map((group) => [group.label, group.id]));
      const itemPayload = DEFAULT_NAV_GROUPS.flatMap((group) =>
        group.items.map((item) => ({
          group_id: groupMap.get(group.label),
          label: item.label,
          path: item.path,
          icon: item.icon,
          order_index: item.order_index,
          is_visible: item.is_visible,
          roles: item.roles,
          is_core: item.is_core ?? false,
        })),
      );

      const { error: itemError } = await supabase.from("navigation_items").insert(itemPayload);
      if (itemError) throw itemError;

      toast.success("Default navigation created.");
      queryClient.invalidateQueries({ queryKey: ["navigation-config"] });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Unable to seed defaults.");
    }
  };

  const handleAddGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupForm.label.trim()) {
      toast.error("Group name is required.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("navigation_groups")
        .insert({
          label: groupForm.label.trim(),
          icon: groupForm.icon,
          order_index: groupForm.order_index || groups.length + 1,
          is_active: groupForm.is_active,
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("ไม่พบข้อมูลกลุ่มเมนูที่เพิ่มใหม่");

      toast.success("Group added.");
      setAddGroupOpen(false);
      setGroupForm(EMPTY_GROUP_FORM);
      setGroups((prev) => [
        ...prev,
        {
          id: data.id,
          label: data.label,
          icon: data.icon,
          order_index: data.order_index,
          is_active: data.is_active,
          is_core: data.is_core ?? false,
          items: [],
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ["navigation-config"] });
    } catch (error: any) {
      toast.error(error.message || "Unable to add group.");
    }
  };

  const handleAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm.label.trim() || !itemForm.path.trim() || !itemForm.group_id) {
      toast.error("Please complete item name, route, and group.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("navigation_items")
        .insert({
          group_id: itemForm.group_id,
          label: itemForm.label.trim(),
          path: itemForm.path.trim(),
          icon: itemForm.icon,
          order_index: itemForm.order_index,
          is_visible: itemForm.is_visible,
          roles: itemForm.roles,
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("ไม่พบข้อมูลเมนูที่เพิ่มใหม่");

      toast.success("Navigation item added.");
      setAddItemOpen(false);
      setItemForm(EMPTY_ITEM_FORM);
      setGroups((prev) =>
        prev.map((group) =>
          group.id === itemForm.group_id
            ? {
                ...group,
                items: [
                  ...group.items,
                  {
                    id: data.id,
                    label: data.label,
                    path: data.path,
                    icon: data.icon,
                    order_index: data.order_index,
                    is_visible: data.is_visible,
                    roles: data.roles as NavRole[],
                    is_core: data.is_core ?? false,
                  },
                ],
              }
            : group,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["navigation-config"] });
    } catch (error: any) {
      toast.error(error.message || "Unable to add item.");
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;
    try {
      const { error } = await supabase
        .from("navigation_groups")
        .update({
          label: groupForm.label.trim(),
          icon: groupForm.icon,
          order_index: groupForm.order_index,
          is_active: groupForm.is_active,
        })
        .eq("id", selectedGroup.id);

      if (error) throw error;

      toast.success("Group updated.");
      queryClient.invalidateQueries({ queryKey: ["navigation-config"] });
    } catch (error: any) {
      toast.error(error.message || "Unable to update group.");
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    try {
      const { error } = await supabase
        .from("navigation_items")
        .update({
          label: itemForm.label.trim(),
          path: itemForm.path.trim(),
          icon: itemForm.icon,
          group_id: itemForm.group_id,
          order_index: itemForm.order_index,
          is_visible: itemForm.is_visible,
          roles: itemForm.roles,
        })
        .eq("id", selectedItem.id);

      if (error) throw error;

      toast.success("Navigation item updated.");
      queryClient.invalidateQueries({ queryKey: ["navigation-config"] });
    } catch (error: any) {
      toast.error(error.message || "Unable to update item.");
    }
  };

  const persistOrder = async (nextGroups: NavGroupConfig[]) => {
    const groupUpdates = nextGroups.map((group, index) => ({
      id: group.id,
      order_index: index + 1,
    }));

    const itemUpdates = nextGroups.flatMap((group) =>
      group.items.map((item, index) => ({
        id: item.id,
        group_id: group.id,
        order_index: index + 1,
      })),
    );

    try {
      if (groupUpdates.length > 0) {
        const { error } = await supabase.from("navigation_groups").upsert(groupUpdates, { onConflict: "id" });
        if (error) throw error;
      }

      if (itemUpdates.length > 0) {
        const { error } = await supabase.from("navigation_items").upsert(itemUpdates, { onConflict: "id" });
        if (error) throw error;
      }

      toast.success("Order updated.");
      queryClient.invalidateQueries({ queryKey: ["navigation-config"] });
    } catch (error: any) {
      toast.error(error.message || "Unable to persist order.");
    }
  };

  const handleDropGroup = (targetGroupId: string) => {
    if (!dragState || dragState.type !== "group") return;
    const fromIndex = groups.findIndex((group) => group.id === dragState.groupId);
    const toIndex = groups.findIndex((group) => group.id === targetGroupId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const nextGroups = moveArrayItem(groups, fromIndex, toIndex);
    setGroups(nextGroups);
    persistOrder(nextGroups);
    setDragState(null);
  };

  const handleDropItem = (targetGroupId: string, targetItemId?: string) => {
    if (!dragState || dragState.type !== "item") return;

    const sourceGroupIndex = groups.findIndex((group) => group.id === dragState.groupId);
    const targetGroupIndex = groups.findIndex((group) => group.id === targetGroupId);
    if (sourceGroupIndex === -1 || targetGroupIndex === -1) return;

    const sourceGroup = groups[sourceGroupIndex];
    const sourceItemIndex = sourceGroup.items.findIndex((item) => item.id === dragState.itemId);
    if (sourceItemIndex === -1) return;

    const itemToMove = sourceGroup.items[sourceItemIndex];
    const nextGroups = groups.map((group) => ({ ...group, items: [...group.items] }));

    nextGroups[sourceGroupIndex].items.splice(sourceItemIndex, 1);

    if (targetItemId) {
      const targetItemIndex = nextGroups[targetGroupIndex].items.findIndex((item) => item.id === targetItemId);
      const insertIndex = targetItemIndex === -1 ? nextGroups[targetGroupIndex].items.length : targetItemIndex;
      nextGroups[targetGroupIndex].items.splice(insertIndex, 0, itemToMove);
    } else {
      nextGroups[targetGroupIndex].items.push(itemToMove);
    }

    setGroups(nextGroups);
    persistOrder(nextGroups);
    setDragState(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "group") {
        await supabase.from("navigation_groups").delete().eq("id", deleteTarget.id);
      } else {
        await supabase.from("navigation_items").delete().eq("id", deleteTarget.id);
      }

      toast.success("Item deleted.");
      queryClient.invalidateQueries({ queryKey: ["navigation-config"] });
      setSelected(null);
    } catch (error: any) {
      toast.error(error.message || "Unable to delete.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <MainLayout title="Navigation Items">
      <div className="space-y-6">
        <Card className="border border-border/60 bg-card/80 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600">
                <ListTree className="h-3.5 w-3.5" />
                Navigation Builder
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Manage sidebar structure</h2>
              <p className="text-sm text-muted-foreground">
                Create groups, links, and control visibility for Admin or Staff.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-10 gap-2" onClick={() => setAddGroupOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Sidebar Menu
              </Button>
              <Button className="h-10 gap-2" onClick={() => setAddItemOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Nav Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card className="border border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Loading...</CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="border border-dashed border-border/60 bg-card/80 shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center text-sm text-muted-foreground">
              <LayoutGrid className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-foreground">No navigation structure yet</p>
                <p className="text-xs text-muted-foreground">Seed a default structure to get started.</p>
              </div>
              <Button variant="outline" className="h-9" onClick={handleSeedDefaults}>
                Create default structure
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card className="border border-border/60 bg-card/80 shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="text-sm font-semibold">Sidebar Structure</div>
                <div className="space-y-3">
                  {groups.map((group) => {
                    const GroupIcon = getNavIcon(group.icon);
                    const isSelected = selected?.type === "group" && selected.id === group.id;

                    return (
                      <div
                        key={group.id}
                        className={cn(
                          "rounded-xl border border-border/60 bg-background/60",
                          isSelected && "border-orange-300 ring-1 ring-orange-200",
                        )}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleDropGroup(group.id)}
                      >
                        <div
                          className="flex items-center gap-2 border-b px-3 py-2"
                          draggable
                          onDragStart={() => setDragState({ type: "group", groupId: group.id })}
                          onClick={() => setSelected({ type: "group", id: group.id })}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <GroupIcon className="h-4 w-4 text-orange-500" />
                          <div className="flex-1 text-sm font-medium">{group.label}</div>
                          {group.is_core && (
                            <Badge variant="outline" className="text-[10px]">
                              Core
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 p-2">
                          {group.items.map((item) => {
                            const ItemIcon = getNavIcon(item.icon);
                            const itemSelected = selected?.type === "item" && selected.id === item.id;

                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm",
                                  "hover:border-orange-200 hover:bg-orange-50",
                                  itemSelected && "border-orange-300 bg-orange-50",
                                )}
                                draggable
                                onDragStart={() =>
                                  setDragState({ type: "item", groupId: group.id, itemId: item.id })
                                }
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => handleDropItem(group.id, item.id)}
                                onClick={() => setSelected({ type: "item", id: item.id })}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <ItemIcon className="h-4 w-4" />
                                <div className="flex-1 truncate">{item.label}</div>
                                {!item.is_visible && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Hidden
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                          <div
                            className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => handleDropItem(group.id)}
                          >
                            Drag items here to append
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60 bg-card/80 shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="text-sm font-semibold">Editor</div>
                {!selected && (
                  <div className="rounded-xl border border-dashed border-border/60 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                    Select a group or item to edit details.
                  </div>
                )}

                {selectedGroup && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Group</Badge>
                      <span className="text-sm font-semibold">{selectedGroup.label}</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Group title</Label>
                      <Input
                        value={groupForm.label}
                        onChange={(event) =>
                          setGroupForm((prev) => ({ ...prev, label: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <Select
                        value={groupForm.icon}
                        onValueChange={(value) => setGroupForm((prev) => ({ ...prev, icon: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select icon" />
                        </SelectTrigger>
                        <SelectContent>
                          {NAV_ICON_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <option.icon className="h-4 w-4" />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">Visible group</div>
                        <div className="text-xs text-muted-foreground">Show group in sidebar</div>
                      </div>
                      <Switch
                        checked={groupForm.is_active}
                        onCheckedChange={(value) =>
                          setGroupForm((prev) => ({ ...prev, is_active: value }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">Order</div>
                        <div className="text-xs text-muted-foreground">Lower appears first</div>
                      </div>
                      <Input
                        type="number"
                        value={groupForm.order_index}
                        onChange={(event) =>
                          setGroupForm((prev) => ({ ...prev, order_index: Number(event.target.value) }))
                        }
                        className="w-24"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button className="gap-2" onClick={handleUpdateGroup}>
                        <Save className="h-4 w-4" />
                        Save group
                      </Button>
                      {!selectedGroup.is_core && (
                        <Button
                          variant="destructive"
                          className="gap-2"
                          onClick={() =>
                            setDeleteTarget({
                              type: "group",
                              id: selectedGroup.id,
                              label: selectedGroup.label,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete group
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {selectedItem && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Item</Badge>
                      <span className="text-sm font-semibold">{selectedItem.label}</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Label</Label>
                      <Input
                        value={itemForm.label}
                        onChange={(event) =>
                          setItemForm((prev) => ({ ...prev, label: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Route</Label>
                      <Input
                        value={itemForm.path}
                        onChange={(event) =>
                          setItemForm((prev) => ({ ...prev, path: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <Select
                        value={itemForm.icon}
                        onValueChange={(value) => setItemForm((prev) => ({ ...prev, icon: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select icon" />
                        </SelectTrigger>
                        <SelectContent>
                          {NAV_ICON_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <option.icon className="h-4 w-4" />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Group</Label>
                      <Select
                        value={itemForm.group_id}
                        onValueChange={(value) => setItemForm((prev) => ({ ...prev, group_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">Visible item</div>
                        <div className="text-xs text-muted-foreground">Show link in sidebar</div>
                      </div>
                      <Switch
                        checked={itemForm.is_visible}
                        onCheckedChange={(value) =>
                          setItemForm((prev) => ({ ...prev, is_visible: value }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border px-3 py-3">
                      <div className="text-sm font-medium">Role visibility</div>
                      <div className="flex flex-wrap gap-3">
                        {ROLE_OPTIONS.map((role) => {
                          const checked = itemForm.roles.includes(role.value as NavRole);
                          return (
                            <label key={role.value} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  setItemForm((prev) => {
                                    const nextRoles = new Set(prev.roles);
                                    if (value) {
                                      nextRoles.add(role.value as NavRole);
                                    } else {
                                      nextRoles.delete(role.value as NavRole);
                                    }
                                    return { ...prev, roles: Array.from(nextRoles) as NavRole[] };
                                  });
                                }}
                              />
                              {role.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">Order</div>
                        <div className="text-xs text-muted-foreground">Lower appears first</div>
                      </div>
                      <Input
                        type="number"
                        value={itemForm.order_index}
                        onChange={(event) =>
                          setItemForm((prev) => ({ ...prev, order_index: Number(event.target.value) }))
                        }
                        className="w-24"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button className="gap-2" onClick={handleUpdateItem}>
                        <Save className="h-4 w-4" />
                        Save item
                      </Button>
                      {!selectedItem.is_core && (
                        <Button
                          variant="destructive"
                          className="gap-2"
                          onClick={() =>
                            setDeleteTarget({
                              type: "item",
                              id: selectedItem.id,
                              label: selectedItem.label,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete item
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Sidebar Menu</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddGroup} className="space-y-4">
            <div className="space-y-2">
              <Label>Group title</Label>
              <Input
                value={groupForm.label}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, label: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={groupForm.icon}
                onValueChange={(value) => setGroupForm((prev) => ({ ...prev, icon: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  {NAV_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Visible</div>
                <div className="text-xs text-muted-foreground">Show group in sidebar</div>
              </div>
              <Switch
                checked={groupForm.is_active}
                onCheckedChange={(value) => setGroupForm((prev) => ({ ...prev, is_active: value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddGroupOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create group</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Nav Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={itemForm.label}
                onChange={(event) => setItemForm((prev) => ({ ...prev, label: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Route</Label>
              <Input
                value={itemForm.path}
                onChange={(event) => setItemForm((prev) => ({ ...prev, path: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={itemForm.icon}
                onValueChange={(value) => setItemForm((prev) => ({ ...prev, icon: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  {NAV_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={itemForm.group_id}
                onValueChange={(value) => setItemForm((prev) => ({ ...prev, group_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Visible</div>
                <div className="text-xs text-muted-foreground">Show item in sidebar</div>
              </div>
              <Switch
                checked={itemForm.is_visible}
                onCheckedChange={(value) => setItemForm((prev) => ({ ...prev, is_visible: value }))}
              />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border px-3 py-3">
              <div className="text-sm font-medium">Role visibility</div>
              <div className="flex flex-wrap gap-3">
                {ROLE_OPTIONS.map((role) => {
                  const checked = itemForm.roles.includes(role.value as NavRole);
                  return (
                    <label key={role.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setItemForm((prev) => {
                            const nextRoles = new Set(prev.roles);
                            if (value) {
                              nextRoles.add(role.value as NavRole);
                            } else {
                              nextRoles.delete(role.value as NavRole);
                            }
                            return { ...prev, roles: Array.from(nextRoles) as NavRole[] };
                          });
                        }}
                      />
                      {role.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddItemOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create item</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {deleteTarget?.label}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
