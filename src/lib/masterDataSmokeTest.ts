import { masterDataApi } from "@/lib/masterDataApi";

interface SmokeTestOptions {
  mutate?: boolean;
}

const logSection = (label: string, value: unknown) => {
  console.info(label, value);
};

// Usage (dev): runMasterDataSmokeTest({ mutate: true }) to exercise create/update/delete.
export async function runMasterDataSmokeTest(options: SmokeTestOptions = {}) {
  const { mutate = false } = options;
  const stamp = new Date().toISOString();

  console.group("[SmokeTest] Master Data");
  try {
    const [departments, locations, categories] = await Promise.all([
      masterDataApi.listDepartments(),
      masterDataApi.listLocations(),
      masterDataApi.listCategories(),
    ]);

    logSection("Departments", departments.length);
    logSection("Locations", locations.length);
    logSection("Categories", categories.length);

    if (!mutate) {
      console.info("Mutation tests skipped. Pass { mutate: true } to run create/update/delete checks.");
      return;
    }

    const dept = await masterDataApi.createDepartment({
      name: `SmokeTest Department ${stamp}`,
      code: "SMK",
      note: "Smoke test record",
    });
    await masterDataApi.updateDepartment({
      id: dept.id,
      name: `${dept.name} (Updated)`,
    });
    await masterDataApi.deleteDepartment(dept.id);

    const loc = await masterDataApi.createLocation({
      name: `SmokeTest Location ${stamp}`,
      building: "Smoke",
      note: "Smoke test record",
    });
    await masterDataApi.updateLocation({
      id: loc.id,
      name: `${loc.name} (Updated)`,
    });
    await masterDataApi.deleteLocation(loc.id);

    const cat = await masterDataApi.createCategory({
      name: `SmokeTest Category ${stamp}`,
      parent_id: null,
      code: "SMK",
      note: "Smoke test record",
    });
    await masterDataApi.updateCategory({
      id: cat.id,
      name: `${cat.name} (Updated)`,
    });
    await masterDataApi.deleteCategory(cat.id);

    console.info("Mutation tests completed successfully.");
  } catch (error) {
    console.error("Smoke test failed", error);
  } finally {
    console.groupEnd();
  }
}
